from email.message import EmailMessage
import smtplib
import ssl

from app.core.config import settings


def send_cancellation_email(*, to_email: str, booking: object) -> tuple[bool, str | None]:
    """Send cancellation confirmation. Returns (success, error)."""
    if not settings.smtp_host or not settings.smtp_from_email:
        return False, "SMTP chưa được cấu hình."

    message = EmailMessage()
    message["Subject"] = f"Xác nhận huỷ đặt bàn {booking.ma_dat_ban}"
    message["From"] = settings.smtp_from_email
    message["To"] = to_email

    area = getattr(booking, "khu_vuc", None)
    table = getattr(booking, "ban", None)
    area_name = getattr(area, "ten_khu_vuc", None) or "Bất kỳ"
    table_name = getattr(table, "ma_ban", None) or "Chưa xếp bàn"

    message.set_content(
        f"""Xin chào {booking.ho_ten_khach},

Nhà hàng xác nhận yêu cầu huỷ đặt bàn của bạn đã được xử lý thành công.

Mã đặt bàn: {booking.ma_dat_ban}
Thời gian: {booking.ngay_dat.strftime("%d/%m/%Y")} {booking.gio_bat_dau.strftime("%H:%M")}
Số khách: {booking.so_luong_khach}
Khu vực: {area_name}
Bàn: {table_name}
Trạng thái: ĐÃ HUỶ

Nếu bạn cần hỗ trợ, vui lòng gọi {settings.restaurant_phone or "số điện thoại của nhà hàng"}.

Trân trọng,
Nhà hàng Resto
"""
    )

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
