"""Time-based display lifecycle for unarrived confirmed table bookings.

A booking reserves 90 minutes of expected use plus 15 minutes for cleanup.
This is intentionally applied on table reads; it never closes an active service session.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ban import Ban
from app.models.dat_ban import DatBan
from app.models.phien_ban import PhienBan

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
SERVICE_MINUTES = 90
CLEANUP_MINUTES = 15
ACTIVE_SESSION_STATUSES = {"DANG_PHUC_VU", "CHO_THANH_TOAN"}


def reconcile_reserved_table(db: Session, table: Ban, now: datetime | None = None) -> bool:
    """Reconcile DA_DAT tables from booking schedule; return whether it changed."""
    now = now or datetime.now(VIETNAM_TZ)
    if now.tzinfo is None:
        now = now.replace(tzinfo=VIETNAM_TZ)
    else:
        now = now.astimezone(VIETNAM_TZ)

    if table.trang_thai not in {"DA_DAT", "DANG_DON"}:
        return False

    active_session = db.scalar(
        select(PhienBan.id).where(
            PhienBan.ban_id == table.id,
            PhienBan.trang_thai.in_(ACTIVE_SESSION_STATUSES),
        ).limit(1)
    )
    if active_session is not None:
        return False

    bookings = db.scalars(
        select(DatBan).where(
            DatBan.ban_id == table.id,
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.khach_toi_at.is_(None),
        ).order_by(DatBan.ngay_dat, DatBan.gio_bat_dau, DatBan.id)
    ).all()

    windows = []
    for booking in bookings:
        start = datetime.combine(booking.ngay_dat, booking.gio_bat_dau, VIETNAM_TZ)
        service_end = start + timedelta(minutes=booking.thoi_luong_giu_ban or SERVICE_MINUTES)
        cleanup_end = service_end + timedelta(minutes=CLEANUP_MINUTES)
        windows.append((start, service_end, cleanup_end))

    next_state = table.trang_thai
    future_booking = any(start > now for start, _, _ in windows)
    in_service_window = any(start <= now < service_end for start, service_end, _ in windows)
    in_cleanup_window = any(service_end <= now < cleanup_end for _, service_end, cleanup_end in windows)

    if table.trang_thai == "DANG_DON":
        # Do not auto-release a table that staff manually marked for cleaning
        # after an actual service session. Only continue a timed cleanup that
        # began during an unarrived booking's scheduled cleanup window.
        changed_at = table.trang_thai_changed_at
        if changed_at is None:
            return False
        if changed_at.tzinfo is None:
            changed_at = changed_at.replace(tzinfo=VIETNAM_TZ)
        else:
            changed_at = changed_at.astimezone(VIETNAM_TZ)
        lifecycle_cleanup = any(
            service_end <= changed_at < cleanup_end
            for _, service_end, cleanup_end in windows
        )
        if not lifecycle_cleanup:
            return False
        if now < changed_at + timedelta(minutes=CLEANUP_MINUTES):
            return False
        next_state = "DA_DAT" if future_booking else "TRONG"
    # A reservation currently within its 90-minute expected use window remains reserved.
    elif in_service_window:
        next_state = "DA_DAT"
    # Between the expected service end and cleanup end, show cleaning.
    elif in_cleanup_window:
        next_state = "DANG_DON"
    # If another confirmed booking is still in the future, keep the table reserved.
    elif future_booking:
        next_state = "DA_DAT"
    # Once the last unarrived booking's 90+15 minutes have elapsed, release the hold.
    elif windows and all(cleanup_end <= now for _, _, cleanup_end in windows):
        next_state = "TRONG"
    if next_state != table.trang_thai:
        table.trang_thai = next_state
        if next_state == "DANG_DON":
            # Anchor the fixed cleanup window to the scheduled 90-minute end,
            # not the time the next API request happens to arrive.
            table.trang_thai_changed_at = next(
                service_end
                for _, service_end, cleanup_end in windows
                if service_end <= now < cleanup_end
            )
        else:
            table.trang_thai_changed_at = now
        db.commit()
        db.refresh(table)
        return True
    return False


def reconcile_reserved_tables(db: Session, tables: list[Ban], now: datetime | None = None) -> None:
    changed = False
    for table in tables:
        changed = reconcile_reserved_table(db, table, now) or changed
    if changed:
        db.commit()
