"""Business logic for waiter-confirmed table cleanup completion."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ban import Ban
from app.models.dat_ban import DatBan

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
NEXT_BOOKING_MINUTES = 30


def finish_table_cleanup(db: Session, table_id: int, now: datetime | None = None) -> Ban:
    """Only release a table currently being cleaned; preserve a near-term booking."""
    now = now or datetime.now(VIETNAM_TZ)
    if now.tzinfo is None:
        now = now.replace(tzinfo=VIETNAM_TZ)
    else:
        now = now.astimezone(VIETNAM_TZ)

    table = db.scalar(select(Ban).where(Ban.id == table_id).with_for_update())
    if table is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn.")
    if table.trang_thai != "DANG_DON":
        raise HTTPException(
            status_code=409,
            detail="Chỉ có thể báo dọn xong khi bàn đang ở trạng thái đang dọn.",
        )

    horizon = now + timedelta(minutes=NEXT_BOOKING_MINUTES)
    bookings = db.scalars(
        select(DatBan).where(
            DatBan.ban_id == table.id,
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.khach_toi_at.is_(None),
            DatBan.ngay_dat >= now.date(),
        ).order_by(DatBan.ngay_dat, DatBan.gio_bat_dau, DatBan.id)
    ).all()

    upcoming = None
    for booking in bookings:
        arrival_at = datetime.combine(booking.ngay_dat, booking.gio_bat_dau, VIETNAM_TZ)
        if now <= arrival_at <= horizon:
            upcoming = booking
            break

    table.trang_thai = "DA_DAT" if upcoming else "TRONG"
    table.trang_thai_changed_at = now
    db.commit()
    db.refresh(table)
    return table
