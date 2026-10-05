from email.message import EmailMessage
import smtplib
import ssl
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from app.models.dat_ban import DatBan
    from app.models.thong_bao import ThongBao


def _send_message(message: EmailMessage) -> tuple[bool, str | None]:
    if not settings.smtp_host or not settings.smtp_from_email:
        return False, "SMTP chưa được cấu hình."

    try:
        if settings.smtp_use_tls:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
        return True, None
    except Exception as exc:
        return False, str(exc)


def _base_message(*, subject: str, to_email: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    return message


def _booking_datetime(booking: "DatBan") -> str:
    return f"{booking.ngay_dat.strftime('%d/%m/%Y')} {booking.gio_bat_dau.strftime('%H:%M')}"


def send_booking_confirmation_email(*, notification: "ThongBao", booking: "DatBan") -> tuple[bool, str | None]:
    """Send the initial booking confirmation email."""
    message = _base_message(
        subject=f"Xác nhận đặt bàn {booking.ma_dat_ban}",
        to_email=notification.email,
    )

    area = getattr(booking, "khu_vuc", None)
    table = getattr(booking, "ban", None)
    area_name = getattr(area, "ten_khu_vuc", None) or "Bất kỳ"
    table_name = getattr(table, "ma_ban", None) or "Chưa phân bàn"

    message.set_content(
        f"""Xin chào {booking.ho_ten_khach},

Nhà hàng Resto đã ghi nhận yêu cầu đặt bàn của bạn.

Mã đặt bàn: {booking.ma_dat_ban}
Ngày giờ: {_booking_datetime(booking)}
Số khách: {booking.so_luong_khach}
Khu vực: {area_name}
Bàn: {table_name}
Địa chỉ nhà hàng: {settings.restaurant_address}
Số điện thoại nhà hàng: {settings.restaurant_phone or "Chưa cấu hình"}

Trạng thái hiện tại: {booking.trang_thai}
Vui lòng giữ lại email này cùng mã đặt bàn khi tới nhà hàng.

Trân trọng,
Nhà hàng Resto
"""
    )
    return _send_message(message)


def _cancellation_reason(booking: "DatBan") -> str:
    labels = {
        "HET_BAN": "Hết bàn",
        "NGOAI_GIO_PHUC_VU": "Ngoài giờ phục vụ",
        "KHONG_LIEN_LAC_DUOC": "Không liên lạc được",
        "KHACH_YEU_CAU_HUY": "Khách yêu cầu huỷ",
        "NHA_HANG_HUY": "Nhà hàng huỷ đặt bàn",
    }
    return labels.get(booking.ly_do_tu_choi or "", "Theo thông báo của nhà hàng")


def send_cancellation_email(*, notification: "ThongBao", booking: "DatBan") -> tuple[bool, str | None]:
    """Send cancellation/rejection email with the recorded cancellation reason."""
    message = _base_message(
        subject=f"Thông báo huỷ đặt bàn {booking.ma_dat_ban}",
        to_email=notification.email,
    )

    area = getattr(booking, "khu_vuc", None)
    table = getattr(booking, "ban", None)
    area_name = getattr(area, "ten_khu_vuc", None) or "Bất kỳ"
    table_name = getattr(table, "ma_ban", None) or "Chưa xếp bàn"

    message.set_content(
        f"""Xin chào {booking.ho_ten_khach},

Nhà hàng Resto thông báo lượt đặt bàn của bạn đã được huỷ.

Mã đặt bàn: {booking.ma_dat_ban}
Ngày giờ: {_booking_datetime(booking)}
Số khách: {booking.so_luong_khach}
Khu vực: {area_name}
Bàn: {table_name}
Lý do huỷ: {_cancellation_reason(booking)}
Địa chỉ nhà hàng: {settings.restaurant_address}
Số điện thoại nhà hàng: {settings.restaurant_phone or "Chưa cấu hình"}

Nếu cần hỗ trợ, vui lòng liên hệ nhà hàng.

Trân trọng,
Nhà hàng Resto
"""
    )
    return _send_message(message)
