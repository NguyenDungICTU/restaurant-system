from datetime import datetime
from zoneinfo import ZoneInfo


VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

REJECTION_REASON_LABELS = {
    "HET_BAN": "Hết bàn",
    "NGOAI_GIO_PHUC_VU": "Ngoài giờ phục vụ",
    "KHONG_LIEN_LAC_DUOC": "Không liên lạc được",
}


def minutes(value) -> int:
    return value.hour * 60 + value.minute


def overlaps(start_a, end_a, start_b, end_b) -> bool:
    return start_a < end_b and start_b < end_a


def appointment_at(booking) -> datetime:
    return datetime.combine(
        booking.ngay_dat,
        booking.gio_bat_dau,
        VIETNAM_TZ,
    )


def can_move_booking(booking, now: datetime) -> bool:
    return (
        booking.trang_thai == "DA_XAC_NHAN"
        and appointment_at(booking) > now.astimezone(VIETNAM_TZ)
    )


def confirmation_message(booking, table) -> str:
    return (
        f"Đặt bàn DB-{booking.id:06d} đã được xác nhận. "
        f"Bàn: {table.ma_ban}."
    )


def rejection_message(booking, reason: str) -> str:
    return (
        f"Đặt bàn DB-{booking.id:06d} đã bị từ chối. "
        f"Lý do: {REJECTION_REASON_LABELS[reason]}."
    )


def moved_message(booking, table) -> str:
    return (
        f"Đặt bàn DB-{booking.id:06d} đã được chuyển sang "
        f"bàn {table.ma_ban}."
    )
