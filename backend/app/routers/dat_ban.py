"""Yêu cầu đặt bàn, chưa phân bàn hoặc cam kết còn chỗ."""

import secrets
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.dat_ban import DatBan
from app.models.ban import Ban
from app.models.khu_vuc import KhuVuc
from app.models.lich_hoat_dong import CauHinhDatBan, LichHoatDong, NgayNghiDacBiet
from app.models.nhan_vien import NhanVien
from app.schemas.dat_ban import (
    DatBanCreate,
    DatBanResponse,
    PublicBookingResponse,
    PublicTimeSlot,
    PublicTimeSlotsResponse,
    XacNhanDatBan,
)

router = APIRouter(prefix="/api/dat-ban", tags=["Đặt bàn"])
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

MA_DAT_BAN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


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
    payload: DatBanCreate,
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
    )


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

    if table.suc_chua_toi_da < booking.so_luong_khach:
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
