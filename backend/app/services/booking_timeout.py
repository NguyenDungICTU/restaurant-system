"""Booking timeout is calculated on reads; never auto-seat or auto-cancel."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import func, select
from app.models.dat_ban import DatBan
from app.models.ban import Ban
from app.models.phien_ban import PhienBan

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

def aware(value):
    # SQLite tests return naive timestamps; production columns are timestamptz.
    return value.replace(tzinfo=VIETNAM_TZ) if value.tzinfo is None else value.astimezone(VIETNAM_TZ)

def timeout_view(booking, now):
    start = datetime.combine(booking.ngay_dat, booking.gio_bat_dau, VIETNAM_TZ)
    extension = getattr(booking, "gia_han_giu_ban_at", None)
    deadline = aware(extension) + timedelta(minutes=15) if extension else start + timedelta(minutes=15)
    waiting = booking.trang_thai == "DA_XAC_NHAN" and getattr(booking, "khach_toi_at", None) is None
    overdue = waiting and aware(now) >= deadline
    return {"qua_gio_hen": overdue, "da_gia_han": extension is not None,
            "co_the_gia_han": overdue and extension is None,
            "co_the_danh_dau_khong_toi": overdue, "han_giu_ban_at": deadline}

def no_show_warning(db, phone, now):
    now = aware(now)
    count = db.scalar(select(func.count()).select_from(DatBan).where(
        DatBan.so_dien_thoai == phone, DatBan.trang_thai == "KHACH_KHONG_TOI",
        DatBan.khong_toi_at >= now - timedelta(days=90), DatBan.khong_toi_at <= now,
    )) or 0
    return {"so_lan_khong_toi_90_ngay": count, "canh_bao_khong_toi": count >= 3}

def table_timeout_views(db, table_ids, now):
    result = {i: {"qua_gio_hen": False, "dat_ban_qua_gio": []} for i in table_ids}
    if not table_ids:
        return result
    bookings = db.scalars(select(DatBan).where(DatBan.ban_id.in_(table_ids),
        DatBan.trang_thai == "DA_XAC_NHAN", DatBan.khach_toi_at.is_(None),
        DatBan.ngay_dat <= aware(now).date()).order_by(DatBan.ngay_dat, DatBan.gio_bat_dau, DatBan.id))
    for booking in bookings:
        view = timeout_view(booking, now)
        if view["qua_gio_hen"]:
            result[booking.ban_id]["qua_gio_hen"] = True
            result[booking.ban_id]["dat_ban_qua_gio"].append({"id": booking.id, "ma_dat_ban": booking.ma_dat_ban, **view})
    return result

def lock_timeout_booking(db, booking_id, now):
    # Match existing check-in lock order: table first, then booking.
    table_id = db.scalar(select(DatBan.ban_id).where(DatBan.id == booking_id))
    table = None
    if table_id is not None:
        table = db.scalar(select(Ban).where(Ban.id == table_id).with_for_update())
    booking = db.scalar(select(DatBan).where(DatBan.id == booking_id).with_for_update().execution_options(populate_existing=True))
    if booking is None:
        raise HTTPException(404, "Không tìm thấy đơn đặt bàn.")
    if booking.ban_id != table_id:
        raise HTTPException(409, "Đặt bàn vừa đổi bàn. Vui lòng thử lại.")
    if not timeout_view(booking, now)["qua_gio_hen"]:
        raise HTTPException(409, "Chỉ xử lý đơn đã xác nhận, quá hạn giữ bàn và khách chưa tới.")
    return booking, table

def release_no_show_table(db, table):
    if table is None or table.trang_thai != "DA_DAT":
        return
    active = db.scalar(select(PhienBan.id).where(PhienBan.ban_id == table.id,
        PhienBan.trang_thai.in_(["DANG_PHUC_VU", "CHO_THANH_TOAN"])))
    if active is not None:
        raise HTTPException(409, "Bàn đang có phiên phục vụ; không thể giải phóng bằng thao tác không tới.")
    table.trang_thai = "TRONG"
    table.trang_thai_changed_at = datetime.now(VIETNAM_TZ)


def attach_history_warnings(db, bookings, now):
    """One grouped query for staff lists, independent of the number of bookings."""
    phones = {booking.so_dien_thoai for booking in bookings}
    if not phones:
        return
    now = aware(now)
    counts = dict(db.execute(select(DatBan.so_dien_thoai, func.count()).where(
        DatBan.so_dien_thoai.in_(phones), DatBan.trang_thai == "KHACH_KHONG_TOI",
        DatBan.khong_toi_at >= now - timedelta(days=90), DatBan.khong_toi_at <= now,
    ).group_by(DatBan.so_dien_thoai)).all())
    for booking in bookings:
        booking.so_lan_khong_toi_90_ngay = counts.get(booking.so_dien_thoai, 0)
        booking.canh_bao_khong_toi = booking.so_lan_khong_toi_90_ngay >= 3
