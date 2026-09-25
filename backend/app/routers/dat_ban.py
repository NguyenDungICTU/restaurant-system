"""Yêu cầu đặt bàn, chưa phân bàn hoặc cam kết còn chỗ."""

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.dat_ban import DatBan
from app.models.ban import Ban
from app.models.lich_hoat_dong import CauHinhDatBan, LichHoatDong, NgayNghiDacBiet
from app.models.nhan_vien import NhanVien
from app.schemas.dat_ban import DatBanCreate, DatBanResponse
from app.schemas.ban import XacNhanDatBan

router = APIRouter(prefix="/api/dat-ban", tags=["Đặt bàn"])
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _minutes(value) -> int:
    return value.hour * 60 + value.minute


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
    start_at = datetime.combine(payload.ngay_dat, payload.gio_bat_dau, VIETNAM_TZ)
    if start_at <= datetime.now(VIETNAM_TZ):
        raise HTTPException(status_code=400, detail="Ngày và giờ đặt bàn phải ở tương lai.")

    holiday = db.get(NgayNghiDacBiet, payload.ngay_dat)
    if holiday is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Nhà hàng nghỉ đặc biệt: {holiday.ten_ngay_nghi}.",
        )

    schedule = db.get(LichHoatDong, payload.ngay_dat.weekday())
    if schedule is None:
        raise HTTPException(status_code=409, detail="Chưa cấu hình lịch mở cửa cho ngày này.")
    if schedule.la_ngay_nghi:
        raise HTTPException(status_code=400, detail="Nhà hàng nghỉ theo lịch tuần vào ngày này.")
    if schedule.gio_mo_cua is None or schedule.gio_dong_cua is None:
        raise HTTPException(status_code=409, detail="Lịch mở cửa chưa hợp lệ.")

    start = _minutes(payload.gio_bat_dau)
    opening = _minutes(schedule.gio_mo_cua)
    closing = _minutes(schedule.gio_dong_cua)
    if start < opening or (start - opening) % 30:
        raise HTTPException(
            status_code=400,
            detail="Giờ bắt đầu phải nằm trong giờ mở cửa và đúng mốc 30 phút kể từ giờ mở.",
        )
    config = db.get(CauHinhDatBan, 1)
    duration = config.thoi_luong_giu_ban if config else 90
    if duration < 30 or duration > 720 or duration % 30:
        raise HTTPException(status_code=409, detail="Thời lượng giữ bàn chưa hợp lệ.")
    if start + duration > closing:
        raise HTTPException(
            status_code=400,
            detail=f"Không đủ {duration} phút giữ bàn trước giờ đóng cửa.",
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
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


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
            Ban.hoat_dong.is_(True),
            Ban.so_cho >= booking.so_luong_khach,
        ).order_by(Ban.so_cho, Ban.ten_ban)
    ).all()

    available = [
        {
            "id": table.id,
            "ten_ban": table.ten_ban,
            "so_cho": table.so_cho,
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

    if not table.hoat_dong:
        raise HTTPException(
            status_code=409,
            detail="Bàn đã ngừng sử dụng.",
        )

    if table.so_cho < booking.so_luong_khach:
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

    db.commit()
    db.refresh(booking)

    return {
        "id": booking.id,
        "ban_id": table.id,
        "ten_ban": table.ten_ban,
        "trang_thai": booking.trang_thai,
        "message": "Đã phân bàn và xác nhận đơn thành công.",
    }
