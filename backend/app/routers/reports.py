from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.ban import Ban
from app.models.dat_ban import DatBan
from app.models.hoa_don import HoaDon
from app.models.lich_hoat_dong import LichHoatDong
from app.models.nhan_vien import NhanVien
from app.models.phien_ban import PhienBan
from app.services.revenue_report import build_hourly_revenue, summarize_invoices, validate_report_range

router = APIRouter(prefix="/api/reports", tags=["Báo cáo doanh thu"])
TZ = ZoneInfo("Asia/Ho_Chi_Minh")


@router.get("/revenue")
def revenue_report(
    start_date: date | None = Query(default=None, alias="from"),
    end_date: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: NhanVien = Depends(require_roles("QUAN_LY")),
):
    today = datetime.now(TZ).date()
    start = start_date or today
    end = end_date or start
    try:
        validate_report_range(start, end)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    start_at = datetime.combine(start, time.min, tzinfo=TZ)
    end_at = datetime.combine(end + timedelta(days=1), time.min, tzinfo=TZ)
    invoices = list(db.scalars(select(HoaDon).where(
        HoaDon.chot_at >= start_at,
        HoaDon.chot_at < end_at,
        HoaDon.trang_thai == "DA_CHOT",
    ).order_by(HoaDon.chot_at)))

    summary = summarize_invoices(invoices)
    schedules = list(db.scalars(select(LichHoatDong)))
    open_hours = [(item.thu, item.gio_mo_cua, item.gio_dong_cua)
                  for item in schedules if not item.la_ngay_nghi]
    hourly = build_hourly_revenue(invoices, start, end, TZ, open_hours)

    active_table_ids = set(db.scalars(select(PhienBan.ban_id).where(
        PhienBan.trang_thai.in_(("DANG_PHUC_VU", "CHO_THANH_TOAN"))
    )))
    # Guest counts are based on check-ins recorded by the booking workflow.
    # Walk-in sessions have no guest-count field in the current schema.
    guests = db.scalar(select(func.coalesce(
        func.sum(DatBan.so_luong_khach), 0
    )).where(
        DatBan.khach_toi_at >= start_at,
        DatBan.khach_toi_at < end_at,
        DatBan.khach_toi_at.is_not(None),
    )) or 0

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "days": (end - start).days + 1,
        **summary,
        "guest_count": int(guests),
        "active_tables": len(active_table_ids),
        "hourly": hourly,
        "no_data": not summary["has_transactions"],
        "updated_at": datetime.now(TZ).isoformat(),
        "guest_count_note": "Lượt khách từ đặt bàn đã ghi nhận khách đến; phiên khách vãng lai chưa có trường lưu số người.",
    }
