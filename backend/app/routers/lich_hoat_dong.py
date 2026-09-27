"""API lịch nhà hàng. Lưu cấu hình đầy đủ trong một giao dịch."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.lich_hoat_dong import CauHinhDatBan, LichHoatDong, NgayNghiDacBiet
from app.models.nhan_vien import NhanVien
from app.schemas.lich_hoat_dong import (
    CauHinhDatBanUpdate,
    LichCauHinhUpdate,
    LichNgayInput,
    LichTuanUpdate,
    NgayNghiCreate,
)

router = APIRouter(prefix="/api/lich-hoat-dong", tags=["Lịch hoạt động"])


def lich_ngay_to_dict(row: LichHoatDong) -> dict:
    return {
        "thu": row.thu,
        "la_ngay_nghi": row.la_ngay_nghi,
        "gio_mo_cua": row.gio_mo_cua,
        "gio_dong_cua": row.gio_dong_cua,
    }


def _get_all_settings(db: Session) -> dict:
    week = db.scalars(select(LichHoatDong).order_by(LichHoatDong.thu)).all()
    holidays = db.scalars(select(NgayNghiDacBiet).order_by(NgayNghiDacBiet.ngay)).all()
    config = db.get(CauHinhDatBan, 1)
    return {
        "ngay": [lich_ngay_to_dict(row) for row in week],
        "thoi_luong_giu_ban": config.thoi_luong_giu_ban if config else 90,
        "ngay_nghi": [
            {"ngay": row.ngay, "ten_ngay_nghi": row.ten_ngay_nghi}
            for row in holidays
        ],
    }


@router.get("/toan-bo")
def lay_toan_bo_cau_hinh(
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    return _get_all_settings(db)


@router.put("/toan-bo")
def luu_toan_bo_cau_hinh(
    payload: LichCauHinhUpdate,
    current_user: NhanVien = Depends(require_roles("QUAN_LY")),
    db: Session = Depends(get_db),
):
    # Một commit: không để lịch tuần, thời lượng và ngày nghỉ cập nhật dở dang.
    for item in payload.ngay:
        row = db.get(LichHoatDong, item.thu)
        if row is None:
            row = LichHoatDong(thu=item.thu)
            db.add(row)
        row.la_ngay_nghi = item.la_ngay_nghi
        row.gio_mo_cua = None if item.la_ngay_nghi else item.gio_mo_cua
        row.gio_dong_cua = None if item.la_ngay_nghi else item.gio_dong_cua

    config = db.get(CauHinhDatBan, 1)
    if config is None:
        config = CauHinhDatBan(id=1)
        db.add(config)
    config.thoi_luong_giu_ban = payload.thoi_luong_giu_ban

    desired = {item.ngay: item.ten_ngay_nghi for item in payload.ngay_nghi}
    existing = {
        row.ngay: row for row in db.scalars(select(NgayNghiDacBiet)).all()
    }
    for holiday_date, row in existing.items():
        if holiday_date not in desired:
            db.delete(row)
    for holiday_date, name in desired.items():
        if holiday_date in existing:
            existing[holiday_date].ten_ngay_nghi = name
        else:
            db.add(NgayNghiDacBiet(ngay=holiday_date, ten_ngay_nghi=name))

    db.commit()
    return _get_all_settings(db)


@router.get("/tuan", response_model=list[LichNgayInput])
def lay_lich_tuan(
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    rows = db.scalars(select(LichHoatDong).order_by(LichHoatDong.thu)).all()
    return [lich_ngay_to_dict(row) for row in rows]


@router.put("/tuan", response_model=list[LichNgayInput])
def cap_nhat_lich_tuan(
    payload: LichTuanUpdate,
    current_user: NhanVien = Depends(require_roles("QUAN_LY")),
    db: Session = Depends(get_db),
):
    for item in payload.ngay:
        row = db.get(LichHoatDong, item.thu)
        if row is None:
            row = LichHoatDong(thu=item.thu)
            db.add(row)
        row.la_ngay_nghi = item.la_ngay_nghi
        row.gio_mo_cua = None if item.la_ngay_nghi else item.gio_mo_cua
        row.gio_dong_cua = None if item.la_ngay_nghi else item.gio_dong_cua
    db.commit()
    return _get_all_settings(db)["ngay"]


@router.get("/cau-hinh")
def lay_cau_hinh_dat_ban(
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    row = db.get(CauHinhDatBan, 1)
    return {"thoi_luong_giu_ban": row.thoi_luong_giu_ban if row else 90}


@router.put("/cau-hinh")
def cap_nhat_cau_hinh_dat_ban(
    payload: CauHinhDatBanUpdate,
    current_user: NhanVien = Depends(require_roles("QUAN_LY")),
    db: Session = Depends(get_db),
):
    row = db.get(CauHinhDatBan, 1)
    if row is None:
        row = CauHinhDatBan(id=1)
        db.add(row)
    row.thoi_luong_giu_ban = payload.thoi_luong_giu_ban
    db.commit()
    return {"thoi_luong_giu_ban": row.thoi_luong_giu_ban}


@router.get("/ngay-nghi")
def lay_danh_sach_ngay_nghi(
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    return _get_all_settings(db)["ngay_nghi"]


@router.post("/ngay-nghi", status_code=201)
def them_ngay_nghi(
    payload: NgayNghiCreate,
    current_user: NhanVien = Depends(require_roles("QUAN_LY")),
    db: Session = Depends(get_db),
):
    if db.get(NgayNghiDacBiet, payload.ngay) is not None:
        raise HTTPException(status_code=409, detail="Ngày nghỉ này đã tồn tại.")
    row = NgayNghiDacBiet(ngay=payload.ngay, ten_ngay_nghi=payload.ten_ngay_nghi)
    db.add(row)
    db.commit()
    return {"ngay": row.ngay, "ten_ngay_nghi": row.ten_ngay_nghi}


@router.delete("/ngay-nghi/{ngay}")
def xoa_ngay_nghi(
    ngay: date,
    current_user: NhanVien = Depends(require_roles("QUAN_LY")),
    db: Session = Depends(get_db),
):
    row = db.get(NgayNghiDacBiet, ngay)
    if row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngày nghỉ này.")
    db.delete(row)
    db.commit()
    return {"message": "Đã xóa ngày nghỉ thành công."}
