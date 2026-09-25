from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.ban import Ban
from app.models.khu_vuc import KhuVuc
from app.models.nhan_vien import NhanVien
from app.schemas.ban import BanCreate, BanResponse, BanStatusUpdate


router = APIRouter(prefix="/api/ban", tags=["Quản lý bàn"])


@router.get("", response_model=list[BanResponse])
def lay_danh_sach_ban(
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(Ban).order_by(Ban.ten_ban)
        ).all()
    )


@router.post("", response_model=BanResponse, status_code=201)
def them_ban(
    payload: BanCreate,
    current_user: NhanVien = Depends(require_roles("QUAN_LY")),
    db: Session = Depends(get_db),
):
    if payload.khu_vuc_id is not None:
        khu_vuc = db.get(KhuVuc, payload.khu_vuc_id)

        if khu_vuc is None or khu_vuc.trang_thai != "HOAT_DONG":
            raise HTTPException(
                status_code=400,
                detail="Khu vực không tồn tại hoặc đã ngừng sử dụng.",
            )

    ban = Ban(**payload.model_dump())
    db.add(ban)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Tên bàn đã tồn tại.",
        )

    db.refresh(ban)
    return ban


@router.patch("/{ban_id}/trang-thai", response_model=BanResponse)
def cap_nhat_trang_thai_ban(
    ban_id: int,
    payload: BanStatusUpdate,
    current_user: NhanVien = Depends(require_roles("QUAN_LY")),
    db: Session = Depends(get_db),
):
    ban = db.get(Ban, ban_id)

    if ban is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bàn.",
        )

    ban.hoat_dong = payload.hoat_dong
    db.commit()
    db.refresh(ban)

    return ban
