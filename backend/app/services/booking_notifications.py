import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.database.session import SessionLocal
from app.models.dat_ban import DatBan
from app.models.thong_bao import ThongBao
from app.services.email_service import (
    send_booking_confirmation_email,
    send_cancellation_email,
)

logger = logging.getLogger(__name__)
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

CONFIRMATION = "XAC_NHAN_DAT_BAN"
CANCELLATION = "HUY_DAT_BAN"


def queue_booking_notification(db: Session, booking: DatBan, notification_type: str) -> ThongBao | None:
    """Create/update one durable notification job. Sending happens after commit."""
    if not booking.email:
        return None
    if notification_type not in {CONFIRMATION, CANCELLATION}:
        raise ValueError(f"Unsupported notification type: {notification_type}")

    notification = db.scalar(
        select(ThongBao).where(
            ThongBao.dat_ban_id == booking.id,
            ThongBao.loai == notification_type,
        )
    )
    now = datetime.now(VIETNAM_TZ)
    if notification is None:
        notification = ThongBao(
            dat_ban_id=booking.id,
            loai=notification_type,
            email=booking.email,
            trang_thai="CHO_GUI",
            so_lan_thu=0,
            lan_tiep_theo_at=now,
        )
        db.add(notification)
    else:
        notification.email = booking.email
        notification.trang_thai = "CHO_GUI"
        notification.lan_tiep_theo_at = now
        notification.loi_cuoi = None
    return notification


def _claim_one(db: Session, now: datetime) -> ThongBao | None:
    # Recover a job if the process/container died after claiming it but before
    # recording the SMTP result. This keeps the queue durable across restarts.
    stale_before = now - timedelta(minutes=2)
    stale_jobs = db.scalars(
        select(ThongBao).where(
            ThongBao.trang_thai == "DANG_GUI",
            ThongBao.lan_thu_cuoi_at.is_not(None),
            ThongBao.lan_thu_cuoi_at <= stale_before,
            ThongBao.so_lan_thu < 3,
        ).limit(20)
    ).all()
    for stale in stale_jobs:
        stale.trang_thai = "THAT_BAI"
        stale.lan_tiep_theo_at = now
        stale.loi_cuoi = "Tiến trình gửi email bị gián đoạn; hệ thống tự phục hồi lượt thử."
        stale.updated_at = now
    if stale_jobs:
        db.commit()

    notification = db.scalar(
        select(ThongBao)
        .options(selectinload(ThongBao.dat_ban))
        .where(
            ThongBao.trang_thai.in_([ "CHO_GUI", "THAT_BAI" ]),
            ThongBao.lan_tiep_theo_at.is_not(None),
            ThongBao.lan_tiep_theo_at <= now,
            ThongBao.so_lan_thu < 3,
        )
        .order_by(ThongBao.lan_tiep_theo_at.asc(), ThongBao.id.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if notification is None:
        return None

    notification.trang_thai = "DANG_GUI"
    notification.so_lan_thu += 1
    notification.lan_thu_cuoi_at = now
    notification.updated_at = now
    db.commit()
    db.refresh(notification)
    return notification


def process_pending_notifications() -> int:
    """Send due notifications. Safe across restarts and bounded to three attempts."""
    processed = 0
    while True:
        db = SessionLocal()
        try:
            now = datetime.now(VIETNAM_TZ)
            notification = _claim_one(db, now)
            if notification is None:
                return processed

            booking = notification.dat_ban
            if booking is None:
                notification.trang_thai = "THAT_BAI"
                notification.lan_tiep_theo_at = None
                notification.loi_cuoi = "Không tìm thấy lượt đặt bàn."
                notification.updated_at = now
                db.commit()
                processed += 1
                continue

            if notification.loai == CONFIRMATION:
                ok, error = send_booking_confirmation_email(
                    notification=notification,
                    booking=booking,
                )
            else:
                ok, error = send_cancellation_email(
                    notification=notification,
                    booking=booking,
                )

            notification.updated_at = datetime.now(VIETNAM_TZ)
            if ok:
                notification.trang_thai = "DA_GUI"
                notification.da_gui_at = notification.updated_at
                notification.lan_tiep_theo_at = None
                notification.loi_cuoi = None
                logger.info(
                    "Booking email sent: booking=%s type=%s attempt=%s",
                    booking.ma_dat_ban,
                    notification.loai,
                    notification.so_lan_thu,
                )
            else:
                notification.trang_thai = "THAT_BAI"
                notification.loi_cuoi = error or "Lỗi gửi email không xác định."
                if notification.so_lan_thu < 3:
                    notification.lan_tiep_theo_at = (
                        notification.updated_at
                        + timedelta(minutes=settings.notification_retry_minutes)
                    )
                else:
                    notification.lan_tiep_theo_at = None
                logger.error(
                    "Booking email failed: booking=%s type=%s attempt=%s error=%s",
                    booking.ma_dat_ban,
                    notification.loai,
                    notification.so_lan_thu,
                    notification.loi_cuoi,
                )
            db.commit()
            processed += 1
        except Exception:
            db.rollback()
            logger.exception("Unexpected error while processing booking email.")
        finally:
            db.close()


async def notification_worker() -> None:
    import asyncio

    while True:
        try:
            process_pending_notifications()
        except Exception:
            logger.exception("Booking notification worker failed.")
        await asyncio.sleep(settings.notification_worker_interval_seconds)
