from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from app.services.booking_timeout import timeout_view


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
    start = booking_start(booking)

    return {
        "so_lan_khong_toi_90_ngay": getattr(booking, "so_lan_khong_toi_90_ngay", 0),
        "canh_bao_khong_toi": getattr(booking, "canh_bao_khong_toi", False),
        **timeout_view(booking, now),
        "ban_id": getattr(booking, "ban_id", None),
        "id": booking.id,
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
        "co_the_doi_ban": (
            booking.trang_thai == "DA_XAC_NHAN"
            and start > now.astimezone(VIETNAM_TZ)
        ),
        "khu_vuc_yeu_cau_id": getattr(
            booking,
            "khu_vuc_yeu_cau_id",
            None,
        ),
        "email": booking.email,
        "email_xac_nhan_trang_thai": booking.email_xac_nhan_trang_thai,
        "email_xac_nhan_so_lan_thu": booking.email_xac_nhan_so_lan_thu,
        "email_xac_nhan_gui_luc": booking.email_xac_nhan_gui_luc,
        "email_xac_nhan_loi_cuoi": booking.email_xac_nhan_loi_cuoi,
        "email_huy_trang_thai": booking.email_huy_trang_thai,
        "email_huy_so_lan_thu": booking.email_huy_so_lan_thu,
        "email_huy_gui_luc": booking.email_huy_gui_luc,
        "email_huy_loi_cuoi": booking.email_huy_loi_cuoi,
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
