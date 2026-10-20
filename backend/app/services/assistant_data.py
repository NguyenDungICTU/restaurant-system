"""Allowlisted SELECTs only. Never call business GETs which may create sessions."""
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import case, func, select

from app.models.ban import Ban
from app.models.ca_lam_viec import CaLamViec
from app.models.dong_goi_mon import DongGoiMon
from app.models.dot_goi_mon import DotGoiMon
from app.models.hoa_don import HoaDon
from app.models.mon_an import MonAn
from app.models.phien_ban import PhienBan
from app.services.assistant_ranges import TZ, comparison_range, money_text, range_bounds
from app.services.assistant_analytics import analyze

DATA_TOOLS = {
    "tables": {"title": "Trạng thái bàn hiện tại", "roles": ["QUAN_LY", "PHUC_VU"], "page": {"QUAN_LY": "tables", "PHUC_VU": "table-map"}},
    "orders": {"title": "Tiến độ món hiện tại", "roles": ["QUAN_LY", "PHUC_VU", "BEP"], "page": {"QUAN_LY": "service-orders", "PHUC_VU": "service-orders", "BEP": "kitchen"}},
    "revenue": {"title": "Doanh thu hóa đơn", "roles": ["QUAN_LY"], "page": {"QUAN_LY": "revenue-report"}},
    "dishes": {"title": "Top món đã phục vụ", "roles": ["QUAN_LY"], "page": {"QUAN_LY": "reports"}},
    "checkouts": {"title": "Phiên bàn cần thu ngân kiểm tra", "roles": ["QUAN_LY", "THU_NGAN"], "page": {"QUAN_LY": "checkout", "THU_NGAN": "checkout"}},
    "shift": {"title": "Ca đang mở của tôi", "roles": ["THU_NGAN"], "page": {"THU_NGAN": "shift-close"}},
    "dish_trends": {"title": "Món giảm số lượng bán", "roles": ["QUAN_LY"], "page": {"QUAN_LY": "reports"}},
    "cancellations": {"title": "Phân tích món bị hủy", "roles": ["QUAN_LY"], "page": {"QUAN_LY": "reports"}},
    "wait_times": {"title": "Thời gian xử lý và mang món", "roles": ["QUAN_LY", "PHUC_VU", "BEP"], "page": {"QUAN_LY": "service-orders", "PHUC_VU": "service-orders", "BEP": "kitchen"}},
    "busy_hours": {"title": "Khung giờ tiếp nhận món", "roles": ["QUAN_LY"], "page": {"QUAN_LY": "dashboard"}},
}
TABLE_STATUS = {"TRONG": "Trống", "DA_DAT": "Đã đặt", "DANG_SU_DUNG": "Đang sử dụng", "DANG_DON": "Đang dọn", "NGUNG_SU_DUNG": "Ngừng sử dụng"}
ORDER_STATUS = {"CHO_BEP": "Chờ bếp", "DANG_CHE_BIEN": "Đang chế biến", "DA_XONG": "Chờ mang ra", "DA_PHUC_VU": "Đã phục vụ", "DA_HUY": "Đã hủy"}
ACTIVE = ("DANG_PHUC_VU", "CHO_THANH_TOAN")
ANALYTICS = {"dish_trends", "cancellations", "wait_times", "busy_hours"}
DATED = {"revenue", "dishes"} | ANALYTICS


def revenue_snapshot(db, start, end):
    start_at, end_at, days = range_bounds(start, end)
    # Group in Vietnam time on PostgreSQL. SQLite fixtures store local naive stamps.
    stamp = func.timezone("Asia/Ho_Chi_Minh", HoaDon.chot_at) if db.get_bind().dialect.name == "postgresql" else HoaDon.chot_at
    day = func.date(stamp)
    rows = db.execute(select(day, func.sum(HoaDon.tong_thanh_toan), func.count()).where(
        HoaDon.trang_thai == "DA_CHOT", HoaDon.chot_at >= start_at, HoaDon.chot_at < end_at)
        .group_by(day).order_by(day)).all()
    amounts = {str(d): Decimal(str(amount)) for d, amount, _ in rows}
    total = int(sum(amounts.values(), Decimal("0")))
    count = sum(n for _, _, n in rows)
    series = [{"date": (start + timedelta(days=i)).isoformat(),
               "value": int(amounts.get((start + timedelta(days=i)).isoformat(), 0))} for i in range(days)]
    return dict(revenue=total, invoice_count=count, average_invoice=int(total / count) if count else 0, series=series)


def allowed_tools(role):
    return [dict(kind=kind, title=tool["title"], page=tool["page"][role],
                 dated=kind in DATED)
            for kind, tool in DATA_TOOLS.items() if role in tool["roles"]]


def read_data(db, user_id, role, request):
    kind = request.kind
    tool = DATA_TOOLS[kind]
    if role not in tool["roles"]:
        raise HTTPException(403, "Bạn không có quyền tra cứu dữ liệu này.")
    now = datetime.now(TZ)
    start = request.start or now.date()
    end = request.end or start
    if kind not in DATED and (request.start or request.end):
        raise HTTPException(422, "Tra cứu này chỉ phản ánh trạng thái hiện tại, không nhận khoảng ngày.")
    if request.compare_previous and request.comparison:
        raise HTTPException(422, "Chỉ chọn một cách so sánh.")
    if kind not in ("revenue", "dish_trends") and (request.compare_previous or request.comparison):
        raise HTTPException(422, "So sánh hiện hỗ trợ doanh thu hoặc món giảm số lượng bán.")
    start_at, end_at, days = range_bounds(start, end)
    if kind in ANALYTICS:
        analysis = analyze(db, request, start, end)
        if start <= now.date() <= end:
            analysis["note"] += " Khoảng này gồm ngày hôm nay chưa kết thúc; số liệu mới đến thời điểm lấy dữ liệu."
        return dict(kind=kind, title=tool["title"], page=tool["page"][role], updated_at=now.isoformat(),
                    start=start.isoformat(), end=end.isoformat(), **analysis)
    cards, rows, columns = [], [], []
    chart, comparison = None, None
    insights = []
    note = ""
    if kind == "tables":
        counts = dict(db.execute(select(Ban.trang_thai, func.count()).where(Ban.da_cau_hinh.is_(True)).group_by(Ban.trang_thai)).all())
        cards = [dict(label=label, value=counts.get(status, 0)) for status, label in TABLE_STATUS.items()]
        columns = ["Bàn trống", "Sức chứa tối đa"]
        rows = [[table.ma_ban, table.suc_chua_toi_da] for table in db.scalars(select(Ban).where(Ban.da_cau_hinh.is_(True), Ban.trang_thai == "TRONG").order_by(Ban.ma_ban).limit(20))]
        note = "Chỉ bàn đã cấu hình. Danh sách tối đa 20 bàn trống; cần kiểm tra đặt bàn và sức chứa trước khi nhận khách."
    elif kind == "orders":
        counts = dict(db.execute(select(DongGoiMon.trang_thai, func.sum(DongGoiMon.so_luong))
            .join(DotGoiMon, DotGoiMon.id == DongGoiMon.dot_goi_mon_id)
            .join(PhienBan, PhienBan.id == DotGoiMon.phien_ban_id)
            .where(PhienBan.trang_thai.in_(ACTIVE)).group_by(DongGoiMon.trang_thai)).all())
        cards = [dict(label=label, value=int(counts.get(status, 0))) for status, label in ORDER_STATUS.items()]
        columns = ["Bàn", "Món", "Số lượng", "Trạng thái"]
        pending = db.execute(select(Ban.ma_ban, MonAn.ten_mon, DongGoiMon.so_luong, DongGoiMon.trang_thai)
            .select_from(DongGoiMon).join(DotGoiMon, DotGoiMon.id == DongGoiMon.dot_goi_mon_id)
            .join(PhienBan, PhienBan.id == DotGoiMon.phien_ban_id).join(Ban, Ban.id == PhienBan.ban_id)
            .join(MonAn, MonAn.id == DongGoiMon.mon_an_id)
            .where(PhienBan.trang_thai.in_(ACTIVE), DongGoiMon.trang_thai.in_(("CHO_BEP", "DANG_CHE_BIEN", "DA_XONG")))
            .order_by(case((DongGoiMon.trang_thai == "DA_XONG", 0), else_=1), DongGoiMon.thoi_diem_tiep_nhan, DongGoiMon.id)
            .limit(20)).all()
        rows = [[table, dish, qty, ORDER_STATUS[status]] for table, dish, qty, status in pending]
        note = "Tổng số lượng món (không phải số dòng) thuộc các phiên đang phục vụ hoặc chờ thanh toán. Danh sách tối đa 20 dòng món chưa phục vụ; món chờ mang ra được xếp trước."
    elif kind == "revenue":
        current = revenue_snapshot(db, start, end)
        cards = [dict(label="Doanh thu", value=current["revenue"], unit="VND"), dict(label="Hóa đơn đã chốt", value=current["invoice_count"]),
                 dict(label="Trung bình / hóa đơn", value=current["average_invoice"], unit="VND")]
        chart = dict(title="Doanh thu theo ngày", unit="VND", points=current["series"])
        columns = ["Ngày", "Doanh thu (VND)"]
        rows = [[p["date"], p["value"]] for p in current["series"]]
        if current["invoice_count"] == 0:
            insights.append("Chưa có hóa đơn đã chốt trong khoảng ngày này.")
        elif days > 1:
            best = max(current["series"], key=lambda p: p["value"])
            insights.append(f"Ngày {best['date']} có doanh thu cao nhất trong khoảng đang xem: {money_text(best['value'])}.")
        if request.comparison or request.compare_previous:
            previous_start, previous_end = comparison_range(request, start, end)
            previous = revenue_snapshot(db, previous_start, previous_end)
            delta = current["revenue"] - previous["revenue"]
            comparison = dict(start=previous_start.isoformat(), end=previous_end.isoformat(),
                revenue=previous["revenue"], invoice_count=previous["invoice_count"], delta=delta,
                percent=round(delta / previous["revenue"] * 100, 2) if previous["revenue"] else None)
            if previous["revenue"] == 0:
                insights.append("Không tính tỷ lệ tăng/giảm vì doanh thu kỳ so sánh bằng 0.")
            if (previous_end - previous_start).days + 1 != days:
                insights.append("Hai khoảng có số ngày khác nhau; chênh lệch đang so sánh tổng tiền, chưa chuẩn hóa theo ngày.")
        note = "Doanh thu sau giảm giá, không tính hóa đơn hủy; khoảng ngày theo giờ Việt Nam."
        if start <= now.date() <= end:
            note += " Ngày hôm nay chưa kết thúc; số liệu chỉ đến thời điểm lấy dữ liệu."
    elif kind == "dishes":
        sold_at = func.coalesce(DongGoiMon.phuc_vu_at, DongGoiMon.updated_at)
        quantity = func.sum(DongGoiMon.so_luong)
        amount = func.sum(DongGoiMon.don_gia * DongGoiMon.so_luong)
        result = db.execute(select(MonAn.ten_mon, quantity, amount).join(DongGoiMon, DongGoiMon.mon_an_id == MonAn.id)
            .where(DongGoiMon.trang_thai == "DA_PHUC_VU", DongGoiMon.tinh_tien.is_(True), sold_at >= start_at, sold_at < end_at)
            .group_by(MonAn.id, MonAn.ten_mon).order_by(quantity.desc(), amount.desc(), MonAn.ten_mon, MonAn.id).limit(request.limit)).all()
        columns = ["Món", "Số lượng", "Tiền món (VND)"]
        rows = [[name, int(qty), int(total)] for name, qty, total in result]
        note = f"Top {request.limit} theo số lượng, chỉ món đã phục vụ có tính tiền. Tiền món chưa trừ giảm giá hóa đơn."
    elif kind == "checkouts":
        statuses = dict(db.execute(select(PhienBan.trang_thai, func.count()).where(PhienBan.trang_thai.in_(ACTIVE)).group_by(PhienBan.trang_thai)).all())
        cards = [dict(label="Chờ thanh toán", value=statuses.get("CHO_THANH_TOAN", 0)), dict(label="Đang phục vụ", value=statuses.get("DANG_PHUC_VU", 0))]
        columns = ["Bàn", "Trạng thái"]
        rows = [[code, "Chờ thanh toán" if status == "CHO_THANH_TOAN" else "Đang phục vụ"]
                for code, status in db.execute(select(Ban.ma_ban, PhienBan.trang_thai).join(PhienBan, PhienBan.ban_id == Ban.id)
                    .where(PhienBan.trang_thai.in_(ACTIVE)).order_by(Ban.ma_ban).limit(20))]
        note = "Hiển thị tối đa 20 phiên. Mở Thanh toán để kiểm tra món và số tiền; trợ lý không chốt hóa đơn."
    elif kind == "shift":
        shift = db.scalar(select(CaLamViec).where(CaLamViec.nhan_vien_id == user_id, CaLamViec.trang_thai == "DANG_MO")
            .order_by(CaLamViec.bat_dau_at.desc()).limit(1))
        if shift is None:
            note = "Bạn chưa có ca đang mở. Trợ lý không tự tạo ca mới."
        else:
            amount, count = db.execute(select(func.coalesce(func.sum(HoaDon.tong_thanh_toan), 0), func.count()).where(
                HoaDon.ca_lam_viec_id == shift.id, HoaDon.trang_thai == "DA_CHOT")).one()
            cards = [dict(label="Mã ca", value=shift.id), dict(label="Hóa đơn đã chốt", value=count), dict(label="Doanh thu ca", value=int(amount), unit="VND")]
            note = "Chỉ ca đang mở thuộc tài khoản của bạn; số liệu cộng từ hóa đơn còn hiệu lực."
    summary = ""
    if kind == "revenue":
        summary = f"Khoảng đang xem ghi nhận {cards[1]['value']} hóa đơn đã chốt, tổng doanh thu {money_text(cards[0]['value'])}."
    elif kind == "tables":
        summary = f"Hiện có {cards[0]['value']} bàn trống trên {sum(c['value'] for c in cards)} bàn đã cấu hình."
    elif kind == "orders":
        summary = f"Có {cards[0]['value']} món chờ bếp, {cards[1]['value']} món đang chế biến và {cards[2]['value']} món chờ mang ra."
    elif kind == "dishes":
        summary = f"Món dẫn đầu theo số lượng: {rows[0][0]} ({rows[0][1]} phần/đơn vị)." if rows else "Chưa có món đã phục vụ có tính tiền trong khoảng này."
    elif kind == "checkouts":
        summary = f"Có {cards[0]['value']} phiên chờ thanh toán và {cards[1]['value']} phiên đang phục vụ."
    elif kind == "shift":
        summary = f"Ca #{cards[0]['value']} của bạn có {cards[1]['value']} hóa đơn, doanh thu {money_text(cards[2]['value'])}." if cards else note
    return dict(kind=kind, title=tool["title"], page=tool["page"][role], cards=cards, columns=columns, summary=summary,
                chart=chart, comparison=comparison, insights=insights,
                rows=rows, note=note, updated_at=now.isoformat(),
                start=start.isoformat() if kind in ("revenue", "dishes") else None,
                end=end.isoformat() if kind in ("revenue", "dishes") else None)
