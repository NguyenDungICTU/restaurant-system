"""Yêu cầu đặt bàn, chưa phân bàn hoặc cam kết còn chỗ."""

import secrets
import re
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.config import settings
from app.dependencies.roles import require_roles
from app.models.dat_ban import DatBan
from app.models.ban import Ban
from app.models.khu_vuc import KhuVuc
from app.models.lich_hoat_dong import CauHinhDatBan, LichHoatDong, NgayNghiDacBiet
from app.models.nhan_vien import NhanVien
from app.schemas.dat_ban import (
    DatBanCreate,
    PublicBookingCreate,
    PublicBookingLookupResponse,
    DatBanResponse,
    PublicBookingResponse,
    PublicTimeSlot,
    PublicTimeSlotsResponse,
    XacNhanDatBan,
)
from app.models.thong_bao import ThongBao
from app.services.email_service import send_cancellation_email

from collections import defaultdict, deque
from threading import Lock


router = APIRouter(prefix="/api/dat-ban", tags=["Đặt bàn"])
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

MA_DAT_BAN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

# Public booking lookup is intentionally rate-limited per client IP without
# introducing a new database table/migration. This is suitable for the
# current single-container deployment.
_LOOKUP_FAILURES: dict[str, deque[datetime]] = defaultdict(deque)
_LOOKUP_RATE_LOCK = Lock()
_LOOKUP_WINDOW_SECONDS = 10 * 60
_LOOKUP_MAX_FAILURES = 5


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    return real_ip or (request.client.host if request.client else "unknown")


def _is_lookup_blocked(ip: str) -> tuple[bool, int]:
    now = datetime.now(VIETNAM_TZ)
    with _LOOKUP_RATE_LOCK:
        attempts = _LOOKUP_FAILURES[ip]
        while attempts and (now - attempts[0]).total_seconds() >= _LOOKUP_WINDOW_SECONDS:
            attempts.popleft()
        if len(attempts) >= _LOOKUP_MAX_FAILURES:
            retry = int(_LOOKUP_WINDOW_SECONDS - (now - attempts[0]).total_seconds()) + 1
            return True, max(retry, 1)
    return False, 0


def _record_lookup_failure(ip: str) -> None:
    now = datetime.now(VIETNAM_TZ)
    with _LOOKUP_RATE_LOCK:
        attempts = _LOOKUP_FAILURES[ip]
        while attempts and (now - attempts[0]).total_seconds() >= _LOOKUP_WINDOW_SECONDS:
            attempts.popleft()
        attempts.append(now)


def _clear_lookup_failures(ip: str) -> None:
    with _LOOKUP_RATE_LOCK:
        _LOOKUP_FAILURES.pop(ip, None)


def _booking_public_view(booking: DatBan) -> PublicBookingLookupResponse:
    start_at = datetime.combine(booking.ngay_dat, booking.gio_bat_dau, VIETNAM_TZ)
    remaining = max(int((start_at - datetime.now(VIETNAM_TZ)).total_seconds() // 60), 0)
    can_cancel = (
        remaining >= 60
        and booking.trang_thai in {"CHO_XAC_NHAN", "DA_XAC_NHAN"}
    )
    if booking.trang_thai == "DA_HUY":
        cancel_message = "Đặt bàn đã được huỷ."
    elif remaining < 60:
        cancel_message = "Đã dưới 60 phút trước giờ hẹn. Vui lòng gọi trực tiếp cho nhà hàng."
    elif booking.trang_thai not in {"CHO_XAC_NHAN", "DA_XAC_NHAN"}:
        cancel_message = "Đặt bàn hiện không thể huỷ trực tuyến."
    else:
        cancel_message = None

    return PublicBookingLookupResponse(
        id=booking.id,
        ma_dat_ban=booking.ma_dat_ban,
        ho_ten_khach=booking.ho_ten_khach,
        so_dien_thoai=booking.so_dien_thoai,
        email=booking.email,
        so_luong_khach=booking.so_luong_khach,
        ngay_dat=booking.ngay_dat,
        gio_bat_dau=booking.gio_bat_dau,
        thoi_luong_giu_ban=booking.thoi_luong_giu_ban,
        trang_thai=booking.trang_thai,
        ten_khu_vuc=booking.khu_vuc.ten_khu_vuc if booking.khu_vuc else None,
        ten_ban=booking.ban.ma_ban if booking.ban else None,
        ghi_chu=booking.ghi_chu,
        co_the_huy=can_cancel,
        phut_con_lai=remaining,
        so_dien_thoai_quan=settings.restaurant_phone or None,
        thong_bao_huy=cancel_message,
    )


def _minutes(value) -> int:
    return value.hour * 60 + value.minute


def _generate_ma_dat_ban(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(MA_DAT_BAN_ALPHABET) for _ in range(6))
        exists = db.scalar(
            select(DatBan.id).where(DatBan.ma_dat_ban == code)
        )
        if exists is None:
            return code
    raise HTTPException(
        status_code=500,
        detail="Không tạo được mã đặt bàn. Vui lòng thử lại.",
    )


def _validate_booking_window(
    db: Session,
    ngay_dat: date,
    gio_bat_dau: time,
) -> tuple[LichHoatDong, int]:
    start_at = datetime.combine(ngay_dat, gio_bat_dau, VIETNAM_TZ)
    if start_at <= datetime.now(VIETNAM_TZ):
        raise HTTPException(
            status_code=400,
            detail="Ngày và giờ đặt bàn phải ở tương lai.",
        )

    holiday = db.get(NgayNghiDacBiet, ngay_dat)
    if holiday is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Nhà hàng nghỉ đặc biệt: {holiday.ten_ngay_nghi}.",
        )

    schedule = db.get(LichHoatDong, ngay_dat.weekday())
    if schedule is None:
        raise HTTPException(
            status_code=409,
            detail="Chưa cấu hình lịch mở cửa cho ngày này.",
        )
    if schedule.la_ngay_nghi:
        raise HTTPException(
            status_code=400,
            detail="Nhà hàng nghỉ theo lịch tuần vào ngày này.",
        )
    if schedule.gio_mo_cua is None or schedule.gio_dong_cua is None:
        raise HTTPException(
            status_code=409,
            detail="Lịch mở cửa chưa hợp lệ.",
        )

    start = _minutes(gio_bat_dau)
    opening = _minutes(schedule.gio_mo_cua)
    closing = _minutes(schedule.gio_dong_cua)
    if start < opening or (start - opening) % 30:
        raise HTTPException(
            status_code=400,
            detail=(
                "Giờ bắt đầu phải nằm trong giờ mở cửa "
                "và đúng mốc 30 phút kể từ giờ mở."
            ),
        )

    config = db.get(CauHinhDatBan, 1)
    duration = config.thoi_luong_giu_ban if config else 90
    if duration < 30 or duration > 720 or duration % 30:
        raise HTTPException(
            status_code=409,
            detail="Thời lượng giữ bàn chưa hợp lệ.",
        )
    if start + duration > closing:
        raise HTTPException(
            status_code=400,
            detail=f"Không đủ {duration} phút giữ bàn trước giờ đóng cửa.",
        )

    return schedule, duration


def _occupied_table_ids(
    db: Session,
    ngay_dat: date,
    start_minutes: int,
    duration: int,
) -> set[int]:
    end = start_minutes + duration
    confirmed = db.scalars(
        select(DatBan).where(
            DatBan.ngay_dat == ngay_dat,
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.ban_id.is_not(None),
        )
    ).all()

    occupied: set[int] = set()
    for existing in confirmed:
        existing_start = _minutes(existing.gio_bat_dau)
        existing_end = existing_start + existing.thoi_luong_giu_ban
        if existing_start < end and start_minutes < existing_end:
            occupied.add(existing.ban_id)

    return occupied


def _suitable_table_exists(
    db: Session,
    ngay_dat: date,
    start_minutes: int,
    duration: int,
    so_luong_khach: int,
) -> bool:
    occupied = _occupied_table_ids(db, ngay_dat, start_minutes, duration)
    tables = db.scalars(
        select(Ban).where(
            Ban.trang_thai != "NGUNG_SU_DUNG",
            Ban.suc_chua_toi_da >= so_luong_khach,
        )
    ).all()
    return any(table.id not in occupied for table in tables)


@router.get("", response_model=list[DatBanResponse])
def lay_danh_sach_dat_ban(
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    statement = select(DatBan).order_by(
        DatBan.ngay_dat.desc(), DatBan.gio_bat_dau.desc(), DatBan.id.desc()
    )
    return list(db.scalars(statement).all())


@router.post("", response_model=DatBanResponse, status_code=201)
def tao_yeu_cau_dat_ban(
    payload: DatBanCreate,
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    _, duration = _validate_booking_window(
        db, payload.ngay_dat, payload.gio_bat_dau
    )

    booking = DatBan(
        ho_ten_khach=payload.ho_ten_khach,
        so_dien_thoai=payload.so_dien_thoai,
        so_luong_khach=payload.so_luong_khach,
        ngay_dat=payload.ngay_dat,
        gio_bat_dau=payload.gio_bat_dau,
        thoi_luong_giu_ban=duration,
        trang_thai="CHO_XAC_NHAN",
        ghi_chu=payload.ghi_chu,
        khu_vuc_id=payload.khu_vuc_id,
        ma_dat_ban=_generate_ma_dat_ban(db),
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/cong-khai/khu-vuc")
def lay_khu_vuc_cong_khai(
    db: Session = Depends(get_db),
):
    areas = db.scalars(
        select(KhuVuc)
        .where(KhuVuc.trang_thai == "HOAT_DONG")
        .order_by(KhuVuc.thu_tu_hien_thi, KhuVuc.ten_khu_vuc)
    ).all()
    return [
        {"id": area.id, "ten_khu_vuc": area.ten_khu_vuc}
        for area in areas
    ]


@router.get("/cong-khai/khung-gio", response_model=PublicTimeSlotsResponse)
def lay_khung_gio_cong_khai(
    ngay: date,
    so_luong_khach: int = Query(ge=1, le=20),
    db: Session = Depends(get_db),
):
    today = datetime.now(VIETNAM_TZ).date()
    result = PublicTimeSlotsResponse(ngay=ngay)

    if ngay < today:
        result.ly_do = "Ngày đã qua. Vui lòng chọn ngày hôm nay hoặc trong tương lai."
        return result

    holiday = db.get(NgayNghiDacBiet, ngay)
    if holiday is not None:
        result.ly_do = f"Nhà hàng nghỉ đặc biệt: {holiday.ten_ngay_nghi}."
        return result

    schedule = db.get(LichHoatDong, ngay.weekday())
    if (
        schedule is None
        or schedule.gio_mo_cua is None
        or schedule.gio_dong_cua is None
    ):
        result.ly_do = "Nhà hàng chưa cấu hình lịch mở cửa cho ngày này."
        return result
    if schedule.la_ngay_nghi:
        result.ly_do = "Nhà hàng nghỉ theo lịch tuần vào ngày này."
        return result

    config = db.get(CauHinhDatBan, 1)
    duration = config.thoi_luong_giu_ban if config else 90
    result.thoi_luong_giu_ban = duration
    result.gio_mo_cua = schedule.gio_mo_cua.strftime("%H:%M")
    result.gio_dong_cua = schedule.gio_dong_cua.strftime("%H:%M")

    opening = _minutes(schedule.gio_mo_cua)
    closing = _minutes(schedule.gio_dong_cua)

    now_minutes = None
    if ngay == today:
        now = datetime.now(VIETNAM_TZ)
        now_minutes = now.hour * 60 + now.minute

    for start in range(opening, closing - duration + 1, 30):
        hour, minute = divmod(start, 60)
        gio = f"{hour:02d}:{minute:02d}"
        if now_minutes is not None and start <= now_minutes:
            result.khung_gio.append(
                PublicTimeSlot(gio=gio, kha_dung=False, ly_do="Khung giờ đã qua.")
            )
        elif not _suitable_table_exists(
            db, ngay, start, duration, so_luong_khach
        ):
            result.khung_gio.append(
                PublicTimeSlot(
                    gio=gio,
                    kha_dung=False,
                    ly_do="Đã hết bàn phù hợp trong khung giờ này.",
                )
            )
        else:
            result.khung_gio.append(
                PublicTimeSlot(gio=gio, kha_dung=True, ly_do=None)
            )

    return result


@router.post("/cong-khai", response_model=PublicBookingResponse, status_code=201)
def tao_dat_ban_cong_khai(
    payload: PublicBookingCreate,
    db: Session = Depends(get_db),
):
    _, duration = _validate_booking_window(
        db, payload.ngay_dat, payload.gio_bat_dau
    )

    ten_khu_vuc = None
    if payload.khu_vuc_id is not None:
        area = db.get(KhuVuc, payload.khu_vuc_id)
        if area is None:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy khu vực đã chọn.",
            )
        if area.trang_thai != "HOAT_DONG":
            raise HTTPException(
                status_code=409,
                detail="Khu vực đã ngừng nhận đặt bàn. Vui lòng chọn khu vực khác.",
            )
        ten_khu_vuc = area.ten_khu_vuc

    pending = db.scalar(
        select(func.count())
        .select_from(DatBan)
        .where(
            DatBan.so_dien_thoai == payload.so_dien_thoai,
            DatBan.trang_thai == "CHO_XAC_NHAN",
        )
    )
    if pending >= 3:
        raise HTTPException(
            status_code=409,
            detail=(
                "Số điện thoại này đã có 3 lượt đặt bàn đang chờ xác nhận. "
                "Vui lòng liên hệ nhà hàng để được hỗ trợ."
            ),
        )

    start = _minutes(payload.gio_bat_dau)
    if not _suitable_table_exists(
        db, payload.ngay_dat, start, duration, payload.so_luong_khach
    ):
        raise HTTPException(
            status_code=409,
            detail="Khung giờ này đã hết bàn phù hợp. Vui lòng chọn khung giờ khác.",
        )

    booking = DatBan(
        ho_ten_khach=payload.ho_ten_khach,
        so_dien_thoai=payload.so_dien_thoai,
        so_luong_khach=payload.so_luong_khach,
        ngay_dat=payload.ngay_dat,
        gio_bat_dau=payload.gio_bat_dau,
        thoi_luong_giu_ban=duration,
        trang_thai="CHO_XAC_NHAN",
        ghi_chu=payload.ghi_chu,
        khu_vuc_id=payload.khu_vuc_id,
        email=payload.email,
        ma_dat_ban=_generate_ma_dat_ban(db),
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    return PublicBookingResponse(
        ma_dat_ban=booking.ma_dat_ban,
        ho_ten_khach=booking.ho_ten_khach,
        so_dien_thoai=booking.so_dien_thoai,
        so_luong_khach=booking.so_luong_khach,
        ngay_dat=booking.ngay_dat,
        gio_bat_dau=booking.gio_bat_dau,
        thoi_luong_giu_ban=booking.thoi_luong_giu_ban,
        ten_khu_vuc=ten_khu_vuc,
        ghi_chu=booking.ghi_chu,
        trang_thai=booking.trang_thai,
        email=booking.email,
        ten_ban=booking.ten_ban,
    )



@router.post("/cong-khai/tra-cuu", response_model=PublicBookingLookupResponse)
def tra_cuu_dat_ban_cong_khai(
    request: Request,
    ma_dat_ban: str = Query(default=""),
    so_dien_thoai: str = Query(default=""),
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)
    blocked, retry_after = _is_lookup_blocked(ip)
    if blocked:
        raise HTTPException(
            status_code=429,
            detail=f"Bạn đã tra cứu sai quá 5 lần trong 10 phút. Vui lòng thử lại sau {retry_after} giây.",
            headers={"Retry-After": str(retry_after)},
        )

    normalized_code = ma_dat_ban.strip().upper()
    normalized_phone = so_dien_thoai.strip()
    if not re.fullmatch(r"[A-Z0-9]{6}", normalized_code) or not re.fullmatch(r"0\d{9}", normalized_phone):
        _record_lookup_failure(ip)
        raise HTTPException(status_code=404, detail="Mã đặt bàn hoặc số điện thoại không chính xác.")

    booking = db.scalar(
        select(DatBan)
        .where(
            DatBan.ma_dat_ban == normalized_code,
            DatBan.so_dien_thoai == normalized_phone,
        )
        .with_for_update(read=True)
    )
    if booking is None:
        _record_lookup_failure(ip)
        raise HTTPException(
            status_code=404,
            detail="Mã đặt bàn hoặc số điện thoại không chính xác.",
        )

    _clear_lookup_failures(ip)
    return _booking_public_view(booking)


@router.post("/cong-khai/huy", response_model=PublicBookingLookupResponse)
def huy_dat_ban_cong_khai(
    request: Request,
    ma_dat_ban: str = Query(default=""),
    so_dien_thoai: str = Query(default=""),
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)
    blocked, retry_after = _is_lookup_blocked(ip)
    if blocked:
        raise HTTPException(
            status_code=429,
            detail=f"Bạn đã tra cứu sai quá 5 lần trong 10 phút. Vui lòng thử lại sau {retry_after} giây.",
            headers={"Retry-After": str(retry_after)},
        )

    normalized_code = ma_dat_ban.strip().upper()
    normalized_phone = so_dien_thoai.strip()
    if not re.fullmatch(r"[A-Z0-9]{6}", normalized_code) or not re.fullmatch(r"0\d{9}", normalized_phone):
        _record_lookup_failure(ip)
        raise HTTPException(status_code=404, detail="Mã đặt bàn hoặc số điện thoại không chính xác.")

    booking = db.scalar(
        select(DatBan)
        .where(
            DatBan.ma_dat_ban == normalized_code,
            DatBan.so_dien_thoai == normalized_phone,
        )
        .with_for_update()
    )
    if booking is None:
        _record_lookup_failure(ip)
        raise HTTPException(
            status_code=404,
            detail="Mã đặt bàn hoặc số điện thoại không chính xác.",
        )

    _clear_lookup_failures(ip)

    start_at = datetime.combine(booking.ngay_dat, booking.gio_bat_dau, VIETNAM_TZ)
    remaining_minutes = int((start_at - datetime.now(VIETNAM_TZ)).total_seconds() // 60)
    if remaining_minutes < 60:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Chỉ có thể huỷ trực tuyến khi còn ít nhất 60 phút trước giờ hẹn.",
                "so_dien_thoai_quan": settings.restaurant_phone or None,
            },
        )

    if booking.trang_thai == "DA_HUY":
        return _booking_public_view(booking)
    if booking.trang_thai not in {"CHO_XAC_NHAN", "DA_XAC_NHAN"}:
        raise HTTPException(
            status_code=409,
            detail="Đặt bàn hiện không thể huỷ trực tuyến.",
        )

    old_table = booking.ban
    booking.trang_thai = "DA_HUY"
    booking.huy_at = datetime.now(VIETNAM_TZ)

    # A cancelled confirmed booking no longer occupies its assigned table.
    # Only move DA_DAT -> TRONG; never override a table currently in use.
    if old_table is not None and old_table.trang_thai == "DA_DAT":
        other_booking = db.scalar(
            select(DatBan.id).where(
                DatBan.id != booking.id,
                DatBan.ban_id == old_table.id,
                DatBan.ngay_dat == booking.ngay_dat,
                DatBan.trang_thai == "DA_XAC_NHAN",
            ).limit(1)
        )
        if other_booking is None:
            old_table.trang_thai = "TRONG"

    notification = None
    if booking.email:
        notification = db.scalar(
            select(ThongBao).where(
                ThongBao.dat_ban_id == booking.id,
                ThongBao.loai == "HUY_DAT_BAN",
            )
        )
        if notification is None:
            notification = ThongBao(
                dat_ban_id=booking.id,
                loai="HUY_DAT_BAN",
                email=booking.email,
                trang_thai="DANG_GUI",
                so_lan_thu=1,
                lan_thu_cuoi_at=datetime.now(VIETNAM_TZ),
            )
            db.add(notification)
        else:
            notification.email = booking.email
            notification.trang_thai = "DANG_GUI"
            notification.so_lan_thu = min(notification.so_lan_thu + 1, 3)
            notification.lan_thu_cuoi_at = datetime.now(VIETNAM_TZ)

    db.flush()

    email_ok = True
    email_error = None
    if booking.email:
        email_ok, email_error = send_cancellation_email(
            to_email=booking.email,
            booking=booking,
        )
        if notification is not None:
            notification.trang_thai = "DA_GUI" if email_ok else "THAT_BAI"
            notification.da_gui_at = datetime.now(VIETNAM_TZ) if email_ok else None
            notification.loi_cuoi = email_error
            notification.updated_at = datetime.now(VIETNAM_TZ)
    else:
        email_ok = False
        email_error = "Đặt bàn chưa có email."

    db.commit()
    db.refresh(booking)

    result = _booking_public_view(booking)
    if not email_ok:
        result.thong_bao_huy = (
            "Đã huỷ đặt bàn thành công, nhưng email xác nhận chưa gửi được. "
            "Nhà hàng sẽ kiểm tra lại."
        )
    return result


@router.patch("/{booking_id}/huy", response_model=DatBanResponse)
def huy_yeu_cau_dat_ban(
    booking_id: int,
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    booking = db.get(DatBan, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu đặt bàn.")
    if booking.trang_thai not in {"CHO_XAC_NHAN", "DA_HUY"}:
        raise HTTPException(status_code=409, detail="Không thể hủy đơn ở trạng thái hiện tại.")
    booking.trang_thai = "DA_HUY"
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}/ban-trong")
def lay_ban_trong(
    booking_id: int,
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):

    booking = db.get(DatBan, booking_id)

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy yêu cầu đặt bàn.",
        )

    if booking.trang_thai != "CHO_XAC_NHAN":
        raise HTTPException(
            status_code=409,
            detail="Chỉ kiểm tra bàn cho đơn chờ xác nhận.",
        )

    start = _minutes(booking.gio_bat_dau)
    end = start + booking.thoi_luong_giu_ban

    confirmed = db.scalars(
        select(DatBan).where(
            DatBan.ngay_dat == booking.ngay_dat,
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.ban_id.is_not(None),
        )
    ).all()

    occupied_ids = set()

    for existing in confirmed:
        existing_start = _minutes(existing.gio_bat_dau)
        existing_end = existing_start + existing.thoi_luong_giu_ban

        if existing_start < end and start < existing_end:
            occupied_ids.add(existing.ban_id)

    tables = db.scalars(
        select(Ban).where(
            Ban.trang_thai != "NGUNG_SU_DUNG",
            Ban.da_cau_hinh.is_(True),
            Ban.suc_chua_toi_da >= booking.so_luong_khach,
        ).order_by(Ban.suc_chua_toi_da, Ban.ma_ban)
    ).all()

    available = [
        {
            "id": table.id,
            "ma_ban": table.ma_ban,
            "suc_chua_toi_da": table.suc_chua_toi_da,
            "khu_vuc_id": table.khu_vuc_id,
        }
        for table in tables
        if table.id not in occupied_ids
    ]

    return {
        "booking_id": booking.id,
        "so_luong_khach": booking.so_luong_khach,
        "so_ban_trong": len(available),
        "ban_trong": available,
    }


@router.post("/{booking_id}/xac-nhan")
def xac_nhan_va_phan_ban(
    booking_id: int,
    payload: XacNhanDatBan,
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(DatBan)
        .where(DatBan.id == booking_id)
        .with_for_update()
    )

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy đơn đặt bàn.",
        )

    if booking.trang_thai != "CHO_XAC_NHAN":
        raise HTTPException(
            status_code=409,
            detail="Đơn không còn ở trạng thái chờ xác nhận.",
        )

    table = db.scalar(
        select(Ban)
        .where(Ban.id == payload.ban_id)
        .with_for_update()
    )

    if table is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bàn.",
        )

    start_at = datetime.combine(
        booking.ngay_dat,
        booking.gio_bat_dau,
        VIETNAM_TZ,
    )

    if start_at <= datetime.now(VIETNAM_TZ):
        raise HTTPException(
            status_code=409,
            detail="Đơn đã quá giờ bắt đầu.",
        )

    if db.get(NgayNghiDacBiet, booking.ngay_dat) is not None:
        raise HTTPException(
            status_code=409,
            detail="Ngày đặt hiện là ngày nghỉ đặc biệt.",
        )

    schedule = db.get(
        LichHoatDong,
        booking.ngay_dat.weekday(),
    )

    if (
        schedule is None
        or schedule.la_ngay_nghi
        or schedule.gio_mo_cua is None
        or schedule.gio_dong_cua is None
    ):
        raise HTTPException(
            status_code=409,
            detail="Lịch mở cửa không còn phù hợp để xác nhận.",
        )

    start = _minutes(booking.gio_bat_dau)
    end = start + booking.thoi_luong_giu_ban
    opening = _minutes(schedule.gio_mo_cua)
    closing = _minutes(schedule.gio_dong_cua)

    if (
        start < opening
        or end > closing
        or (start - opening) % 30 != 0
    ):
        raise HTTPException(
            status_code=409,
            detail="Giờ đặt không còn phù hợp lịch hoạt động.",
        )

    if table.trang_thai == "NGUNG_SU_DUNG":
        raise HTTPException(status_code=409, detail="Bàn đã ngừng sử dụng.")

    if not table.da_cau_hinh:
        raise HTTPException(
            status_code=409,
            detail="Bàn chưa được cấu hình và chưa thể nhận đặt bàn.",
        )

    if (
        table.suc_chua_toi_da is None
        or table.suc_chua_toi_da < booking.so_luong_khach
    ):
        raise HTTPException(
            status_code=409,
            detail="Bàn không đủ số chỗ cho khách.",
        )

    confirmed = db.scalars(
        select(DatBan).where(
            DatBan.ngay_dat == booking.ngay_dat,
            DatBan.ban_id == table.id,
            DatBan.trang_thai == "DA_XAC_NHAN",
        )
    ).all()

    for existing in confirmed:
        existing_start = _minutes(existing.gio_bat_dau)
        existing_end = (
            existing_start + existing.thoi_luong_giu_ban
        )

        if existing_start < end and start < existing_end:
            raise HTTPException(
                status_code=409,
                detail="Bàn đã có đơn xác nhận trùng giờ.",
            )

    booking.ban_id = table.id
    booking.trang_thai = "DA_XAC_NHAN"
    if table.trang_thai == "TRONG":
        table.trang_thai = "DA_DAT"

    db.commit()
    db.refresh(booking)

    return {
        "id": booking.id,
        "ban_id": table.id,
        "ma_ban": table.ma_ban,
        "trang_thai": booking.trang_thai,
        "message": "Đã phân bàn và xác nhận đơn thành công.",
    }
