from datetime import datetime, timedelta
from email.message import EmailMessage
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.dat_ban import DatBan
from app.models.thong_bao import ThongBao
from app.services.email_service import _send_message

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
REMINDER = "NHAC_DAT_BAN"


def booking_appointment(booking: DatBan) -> datetime:
    return datetime.combine(
        booking.ngay_dat,
        booking.gio_bat_dau,
        VIETNAM_TZ,
    )


def public_booking_lookup_url(booking: DatBan) -> str:
    base = (
        settings.frontend_urls[0]
        if settings.frontend_urls
        else "http://localhost:5173"
    ).rstrip("/")
    query = urlencode(
        {
            "mode": "lookup",
            "booking": booking.ma_dat_ban,
        }
    )
    return f"{base}/?{query}"


def queue_due_booking_reminders(
    db: Session,
    now: datetime | None = None,
) -> int:
    """Create at most one durable reminder job per confirmed booking."""
    current = (now or datetime.now(VIETNAM_TZ)).astimezone(VIETNAM_TZ)
    lead = settings.booking_reminder_lead_minutes
    window = min(settings.booking_reminder_window_minutes, lead)

    target_min = current + timedelta(minutes=lead - window)
    target_max = current + timedelta(minutes=lead)

    bookings = db.scalars(
        select(DatBan)
        .options(
            selectinload(DatBan.thong_bao),
            selectinload(DatBan.ban),
        )
        .where(
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.khach_toi_at.is_(None),
            DatBan.email.is_not(None),
            DatBan.ngay_dat >= target_min.date(),
            DatBan.ngay_dat <= target_max.date(),
        )
        .order_by(
            DatBan.ngay_dat,
            DatBan.gio_bat_dau,
            DatBan.id,
        )
    ).all()

    created = 0

    for booking in bookings:
        appointment = booking_appointment(booking)
        if not (target_min <= appointment <= target_max):
            continue

        if any(item.loai == REMINDER for item in booking.thong_bao):
            continue

        db.add(
            ThongBao(
                dat_ban_id=booking.id,
                loai=REMINDER,
                email=booking.email,
                trang_thai="CHO_GUI",
                so_lan_thu=0,
                lan_tiep_theo_at=current,
            )
        )
        created += 1

    if created:
        db.commit()

    return created


def reminder_block_reason(
    booking: DatBan,
    now: datetime,
) -> str | None:
    if booking.trang_thai != "DA_XAC_NHAN":
        return (
            "Không gửi nhắc: đặt bàn không còn ở trạng thái đã xác nhận "
            f"({booking.trang_thai})."
        )

    if booking.khach_toi_at is not None:
        return "Không gửi nhắc: khách đã được đánh dấu tới nhà hàng."

    if booking.huy_at is not None:
        return "Không gửi nhắc: đặt bàn đã bị huỷ."

    if not booking.email:
        return "Không gửi nhắc: đặt bàn không có địa chỉ email."

    if booking_appointment(booking) <= now:
        return "Không gửi nhắc: giờ hẹn đã tới hoặc đã qua."

    return None


def send_booking_reminder_email(
    *,
    notification: ThongBao,
    booking: DatBan,
) -> tuple[bool, str | None]:
    """Send the S4-08 reminder email."""
    message = EmailMessage()
    message["Subject"] = f"Nhắc lịch đặt bàn {booking.ma_dat_ban}"
    message["From"] = settings.smtp_from_email
    message["To"] = notification.email

    table_name = (
        getattr(getattr(booking, "ban", None), "ma_ban", None)
        or "Chưa xếp bàn"
    )

    now = datetime.now(VIETNAM_TZ)
    appointment = booking_appointment(booking)
    remaining_minutes = int(
        (appointment - now).total_seconds() // 60
    )

    if remaining_minutes > 60:
        cancellation_info = (
            "\nTra cứu / huỷ đặt bàn: "
            f"{public_booking_lookup_url(booking)}\n"
            "Vì lý do bảo mật, vui lòng nhập số điện thoại đã dùng khi đặt "
            "bàn để xác nhận trước khi huỷ.\n"
        )
    else:
        cancellation_info = (
            "\nHiện còn 60 phút hoặc ít hơn trước giờ hẹn nên email không "
            "hiển thị đường dẫn huỷ trực tuyến. Vui lòng liên hệ nhà hàng "
            "nếu cần hỗ trợ.\n"
        )

    appointment_text = (
        f"{booking.ngay_dat.strftime('%d/%m/%Y')} "
        f"{booking.gio_bat_dau.strftime('%H:%M')}"
    )

    message.set_content(
        f"""Xin chào {booking.ho_ten_khach},

Đây là email nhắc lịch đặt bàn của bạn tại nhà hàng Resto.

Mã đặt bàn: {booking.ma_dat_ban}
Giờ hẹn: {appointment_text}
Bàn đã xếp: {table_name}
Số khách: {booking.so_luong_khach}
Địa chỉ nhà hàng: {settings.restaurant_address}
Số điện thoại nhà hàng: {settings.restaurant_phone or "Chưa cấu hình"}
{cancellation_info}
Hẹn gặp bạn tại nhà hàng.

Trân trọng,
Nhà hàng Resto
"""
    )

    return _send_message(message)
