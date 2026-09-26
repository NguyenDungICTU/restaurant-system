from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user, require_manager
from app.models.khu_vuc import KhuVuc
from app.models.ban_an import BanAn
from app.models.nhan_vien import NhanVien
from app.schemas.khu_vuc import (
    KhuVucCreate,
    KhuVucResponse,
    KhuVucUpdate,
)


router = APIRouter(
    prefix="/api/khu-vuc",
    tags=["Khu vực"],
)


def normalized_name_expression():
    return func.lower(func.btrim(KhuVuc.ten_khu_vuc))


def ensure_name_is_available(
    db: Session,
    name: str,
    *,
    excluded_id: int | None = None,
) -> None:
    statement = select(KhuVuc.id).where(
        normalized_name_expression() == name.lower()
    )

    if excluded_id is not None:
        statement = statement.where(KhuVuc.id != excluded_id)

    if db.scalar(statement) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tên khu vực đã tồn tại.",
        )


def get_area_or_404(db: Session, area_id: int) -> KhuVuc:
    area = db.get(KhuVuc, area_id)

    if area is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khu vực.",
        )

    return area


@router.get("", response_model=list[KhuVucResponse])
def list_areas(
    include_inactive: bool = Query(default=True),
    _: NhanVien = Depends(require_manager),
    db: Session = Depends(get_db),
):
    statement = select(KhuVuc)

    if not include_inactive:
        statement = statement.where(KhuVuc.trang_thai == "HOAT_DONG")

    statement = statement.order_by(
        KhuVuc.thu_tu_hien_thi,
        KhuVuc.ten_khu_vuc,
    )

    return list(db.scalars(statement))


@router.get("/active", response_model=list[KhuVucResponse])
def list_active_areas(
    _: NhanVien = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statement = (
        select(KhuVuc)
        .where(KhuVuc.trang_thai == "HOAT_DONG")
        .order_by(KhuVuc.thu_tu_hien_thi, KhuVuc.ten_khu_vuc)
    )

    return list(db.scalars(statement))


@router.post(
    "",
    response_model=KhuVucResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_area(
    payload: KhuVucCreate,
    _: NhanVien = Depends(require_manager),
    db: Session = Depends(get_db),
):
    ensure_name_is_available(db, payload.ten_khu_vuc)

    area = KhuVuc(**payload.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)

    return area


@router.put("/{area_id}", response_model=KhuVucResponse)
def update_area(
    area_id: int,
    payload: KhuVucUpdate,
    _: NhanVien = Depends(require_manager),
    db: Session = Depends(get_db),
):
    area = get_area_or_404(db, area_id)
    ensure_name_is_available(
        db,
        payload.ten_khu_vuc,
        excluded_id=area.id,
    )

    for field, value in payload.model_dump().items():
        setattr(area, field, value)

    db.commit()
    db.refresh(area)

    return area


@router.patch("/{area_id}/ngung-su-dung", response_model=KhuVucResponse)
def deactivate_area(
    area_id: int,
    _: NhanVien = Depends(require_manager),
    db: Session = Depends(get_db),
):
    area = get_area_or_404(db, area_id)
    area.trang_thai = "NGUNG_SU_DUNG"

    db.commit()
    db.refresh(area)

    return area


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: int,
    _: NhanVien = Depends(require_manager),
    db: Session = Depends(get_db),
):
    area = get_area_or_404(db, area_id)
    has_tables = db.scalar(
        select(BanAn.id).where(BanAn.khu_vuc_id == area.id).limit(1)
    )
    if has_tables is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Khu vực đang có bàn thì không thể xóa; hãy ngừng sử dụng khu vực.",
        )
    db.delete(area)
    db.commit()
    return None

@router.patch("/{area_id}/kich-hoat", response_model=KhuVucResponse)
def activate_area(
    area_id: int,
    _: NhanVien = Depends(require_manager),
    db: Session = Depends(get_db),
):
    area = get_area_or_404(db, area_id)
    area.trang_thai = "HOAT_DONG"

    db.commit()
    db.refresh(area)

    return area