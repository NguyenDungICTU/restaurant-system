from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def mask_phone(phone: str) -> str:
    value = (phone or "").strip()
    if len(value) < 7:
        return "*" * len(value)
    return f"{value[:3]}****{value[-3:]}"


def booking_start(booking) -> datetime:
    return datetime.combine(
        booking.ngay_dat,
        booking.gio_bat_dau,
        VIETNAM_TZ,
    )


def is_upcoming_30_minutes(booking, now: datetime) -> bool:
    current = now.astimezone(VIETNAM_TZ).replace(
        second=0,
        microsecond=0,
    )
    start = booking_start(booking)
    return current <= start <= current + timedelta(minutes=30)


def booking_time_range(booking) -> str:
    start = booking_start(booking)
    end = start + timedelta(minutes=booking.thoi_luong_giu_ban)
    return f"{start:%H:%M} - {end:%H:%M}"


def booking_to_staff_view(booking, now: datetime) -> dict:
    return {
        "ma_dat_ban": f"DB-{booking.id:06d}",
        "ho_ten_khach": booking.ho_ten_khach,
        "so_dien_thoai_da_che": mask_phone(booking.so_dien_thoai),
        "so_luong_khach": booking.so_luong_khach,
        "khung_gio": booking_time_range(booking),
        "ten_ban": booking.ten_ban,
        "trang_thai": booking.trang_thai,
        "sap_den_trong_30_phut": is_upcoming_30_minutes(
            booking,
            now,
        ),
    }


def build_today_booking_list(
    bookings,
    now: datetime,
    status: str | None = None,
) -> list[dict]:
    current = now.astimezone(VIETNAM_TZ)

    rows = [
        booking
        for booking in bookings
        if booking.ngay_dat == current.date()
        and (status is None or booking.trang_thai == status)
    ]

    rows.sort(
        key=lambda booking: (
            booking.gio_bat_dau,
            booking.id,
        )
    )

    upcoming = [
        booking
        for booking in rows
        if is_upcoming_30_minutes(booking, current)
    ]
    remaining = [
        booking
        for booking in rows
        if not is_upcoming_30_minutes(booking, current)
    ]

    return [
        booking_to_staff_view(booking, current)
        for booking in upcoming + remaining
    ]
