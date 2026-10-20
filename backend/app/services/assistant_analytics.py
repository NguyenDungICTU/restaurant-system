"""Read-only restaurant analytics with explicit definitions and missing-data handling."""
from sqlalchemy import distinct, func, select

from app.models.dong_goi_mon import DongGoiMon as Line
from app.models.dot_goi_mon import DotGoiMon
from app.models.mon_an import MonAn
from app.services.assistant_ranges import comparison_range, range_bounds


def sold_quantities(db, start, end):
    a, b, _ = range_bounds(start, end)
    stamp = func.coalesce(Line.phuc_vu_at, Line.updated_at)
    return {item_id: (name, int(qty)) for item_id, name, qty in db.execute(
        select(MonAn.id, MonAn.ten_mon, func.sum(Line.so_luong)).join(Line, Line.mon_an_id == MonAn.id)
        .where(Line.trang_thai == "DA_PHUC_VU", Line.tinh_tien.is_(True), stamp >= a, stamp < b)
        .group_by(MonAn.id, MonAn.ten_mon))}


def minutes_between(db, start, end):
    if db.get_bind().dialect.name == "postgresql":
        return func.extract("epoch", end - start) / 60.0
    return (func.julianday(end) - func.julianday(start)) * 1440.0


def analyze(db, request, start, end):
    a, b, _ = range_bounds(start, end)
    result = dict(cards=[], columns=[], rows=[], chart=None, comparison=None, baseline=None, insights=[])
    if request.kind == "dish_trends":
        old_start, old_end = comparison_range(request, start, end)
        current = sold_quantities(db, start, end)
        previous = sold_quantities(db, old_start, old_end)
        changes = []
        for item_id in current.keys() | previous.keys():
            name = current.get(item_id, previous.get(item_id))[0]
            before = previous.get(item_id, (name, 0))[1]
            after = current.get(item_id, (name, 0))[1]
            if after < before:
                changes.append([name, before, after, after - before, round((after - before) / before * 100, 2), item_id])
        changes.sort(key=lambda row: (row[3], row[4], row[0], row[5]))
        result.update(cards=[dict(label="Số lượng món kỳ này", value=sum(q for _, q in current.values())),
            dict(label="Số lượng món kỳ so sánh", value=sum(q for _, q in previous.values())),
            dict(label="Món có số lượng giảm", value=len(changes))],
            columns=["Món", "Kỳ so sánh", "Kỳ này", "Chênh lệch SL", "Thay đổi (%)"],
            rows=[row[:5] for row in changes[:request.limit]],
            baseline=dict(start=old_start.isoformat(), end=old_end.isoformat()),
            summary=f"Có {len(changes)} món giảm số lượng đã phục vụ; danh sách ưu tiên mức giảm tuyệt đối lớn nhất.",
            note="Chỉ món đã phục vụ có tính tiền, theo thời điểm phục vụ (hoặc updated_at nếu thiếu). So sánh số lượng, không phải lợi nhuận; chưa có dữ liệu để kết luận nguyên nhân.")
        if (end - start).days != (old_end - old_start).days:
            result["insights"].append("Hai khoảng có số ngày khác nhau; chênh lệch chưa chuẩn hóa theo ngày.")
        if not previous:
            result["insights"].append("Kỳ so sánh chưa có món đã phục vụ; chưa có cơ sở xác định món bán giảm.")
    elif request.kind == "cancellations":
        stamp = func.coalesce(Line.huy_at, Line.updated_at)
        filters = (Line.trang_thai == "DA_HUY", stamp >= a, stamp < b)
        quantity, count = db.execute(select(func.coalesce(func.sum(Line.so_luong), 0), func.count()).where(*filters)).one()
        rows = db.execute(select(MonAn.ten_mon, func.sum(Line.so_luong), func.count()).join(Line, Line.mon_an_id == MonAn.id)
            .where(*filters).group_by(MonAn.id, MonAn.ten_mon)
            .order_by(func.sum(Line.so_luong).desc(), MonAn.ten_mon, MonAn.id).limit(request.limit)).all()
        result.update(cards=[dict(label="Số lượng món bị hủy", value=int(quantity)), dict(label="Dòng món bị hủy", value=count)],
            columns=["Món", "Số lượng hủy", "Số dòng hủy"], rows=[[name, int(qty), n] for name, qty, n in rows],
            summary=f"Khoảng đang xem ghi nhận {int(quantity)} phần/đơn vị món bị hủy trên {count} dòng món.",
            note="Theo thời điểm hủy (hoặc updated_at nếu thiếu), không phải ngày tiếp nhận đơn. Không suy ra tỷ lệ hủy hoặc thiệt hại từ các số đếm này; không kết luận nguyên nhân khi chưa đối chiếu nghiệp vụ.")
    elif request.kind == "wait_times":
        duration = minutes_between(db, Line.thoi_diem_tiep_nhan, Line.hoan_thanh_at)
        complete_filters = (Line.hoan_thanh_at >= a, Line.hoan_thanh_at < b)
        valid_complete = (*complete_filters, Line.thoi_diem_tiep_nhan.is_not(None), Line.hoan_thanh_at >= Line.thoi_diem_tiep_nhan)
        seen = db.scalar(select(func.count()).select_from(Line).where(*complete_filters))
        avg, n = db.execute(select(func.avg(duration), func.count()).where(*valid_complete)).one()
        service_duration = minutes_between(db, Line.hoan_thanh_at, Line.phuc_vu_at)
        service_filters = (Line.phuc_vu_at >= a, Line.phuc_vu_at < b)
        served_seen = db.scalar(select(func.count()).select_from(Line).where(*service_filters))
        served_avg, served_n = db.execute(select(func.avg(service_duration), func.count()).where(
            *service_filters, Line.hoan_thanh_at.is_not(None), Line.phuc_vu_at >= Line.hoan_thanh_at)).one()
        rows = db.execute(select(MonAn.ten_mon, func.count(), func.avg(duration), func.max(duration))
            .join(Line, Line.mon_an_id == MonAn.id).where(*valid_complete).group_by(MonAn.id, MonAn.ten_mon)
            .order_by(func.avg(duration).desc(), MonAn.ten_mon, MonAn.id).limit(request.limit)).all()
        result.update(cards=[dict(label="Tiếp nhận → hoàn thành", value=round(float(avg), 2) if avg is not None else None, unit="minute"),
            dict(label="Hoàn thành → phục vụ", value=round(float(served_avg), 2) if served_avg is not None else None, unit="minute"),
            dict(label="Dòng hoàn thành đủ mốc", value=n), dict(label="Thiếu/sai mốc hoàn thành", value=seen - n),
            dict(label="Dòng phục vụ đủ mốc", value=served_n), dict(label="Thiếu/sai mốc phục vụ", value=served_seen - served_n)],
            columns=["Món", "Dòng đủ mốc", "TB xử lý (phút)", "Lâu nhất (phút)"],
            rows=[[name, count, round(float(mean), 2), round(float(maximum), 2)] for name, count, mean, maximum in rows],
            summary=(f"Có {n} dòng món đủ mốc để tính thời gian từ tiếp nhận đến hoàn thành."
                if n else "Chưa có đủ mốc thời gian để tính thời gian xử lý món trong khoảng này."),
            note="Trung bình theo dòng món, không nhân số lượng. Tiếp nhận → hoàn thành gồm cả chờ bếp và chế biến; lọc theo ngày hoàn thành. Hoàn thành → phục vụ lọc theo ngày phục vụ. Tính các dòng có mốc hợp lệ kể cả khi sau đó bị hủy. Bỏ mốc thiếu hoặc thời gian âm; không coi thiếu dữ liệu là 0 phút.")
    elif request.kind == "busy_hours":
        stamp = func.timezone("Asia/Ho_Chi_Minh", Line.thoi_diem_tiep_nhan) if db.get_bind().dialect.name == "postgresql" else Line.thoi_diem_tiep_nhan
        hour = func.extract("hour", stamp) if db.get_bind().dialect.name == "postgresql" else func.strftime("%H", stamp)
        filters = (Line.thoi_diem_tiep_nhan >= a, Line.thoi_diem_tiep_nhan < b)
        rows = db.execute(select(hour, func.count(distinct(DotGoiMon.phien_ban_id)), func.sum(Line.so_luong))
            .join(DotGoiMon, DotGoiMon.id == Line.dot_goi_mon_id).where(*filters).group_by(hour)).all()
        by_hour = {int(h): (sessions, int(qty)) for h, sessions, qty in rows}
        sessions = db.scalar(select(func.count(distinct(DotGoiMon.phien_ban_id))).join(Line, Line.dot_goi_mon_id == DotGoiMon.id).where(*filters))
        total = sum(qty for _, qty in by_hour.values())
        peak = max(by_hour, key=lambda h: (by_hour[h][0], by_hour[h][1], -h)) if by_hour else None
        result.update(cards=[dict(label="Phiên có món trong kỳ", value=sessions), dict(label="Số lượng món tiếp nhận", value=total)],
            columns=["Giờ Việt Nam", "Phiên có món", "Số lượng món"],
            rows=[[f"{h:02}:00–{h + 1:02}:00", *by_hour.get(h, (0, 0))] for h in range(24)],
            summary=(f"Khung {peak:02}:00–{peak + 1:02}:00 có nhiều phiên gửi món nhất ({by_hour[peak][0]} phiên)."
                if peak is not None else "Chưa có món được tiếp nhận trong khoảng này."),
            note="Hoạt động tiếp nhận món theo giờ Việt Nam, gồm cả dòng món sau đó bị hủy. Một phiên có thể xuất hiện ở nhiều giờ. Đây không phải số khách vào quán; chưa đủ dữ liệu đếm đầy đủ khách vãng lai.")
    return result
