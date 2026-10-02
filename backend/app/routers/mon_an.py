from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.dependencies.roles import require_roles
from app.models.mon_an import MonAn
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.nhom_mon import NhomMon
from app.schemas.mon_an import MonAnAvailabilityResponse, MonAnAvailabilityUpdate, MonAnCreate, MonAnResponse, MonAnUpdate
from app.services.image_service import save_image, delete_image
from app.services.mon_an_service import create_dish, delete_dish, get_dish, update_dish
from app.services.mon_an_availability_service import reset_expired_temporary_sold_out, set_temporary_sold_out

router = APIRouter(prefix="/api/menu/dishes", tags=["Menu Dishes"])


def dish_to_dict(dish: MonAn) -> dict:
    return {
        "id": dish.id,
        "ten_mon": dish.ten_mon,
        "nhom_mon_id": dish.nhom_mon_id,
        "nhom_mon_ten": dish.nhom_mon.ten_nhom,
        "gia": dish.gia,
        "don_vi_tinh": dish.don_vi_tinh,
        "mo_ta_ngan": dish.mo_ta_ngan,
        "thoi_gian_che_bien_phut": dish.thoi_gian_che_bien_phut,
        "trang_thai": dish.trang_thai,
        "anh_url": dish.anh_url,
    }


@router.get("", response_model=list[MonAnResponse])
def list_dishes(category_id: int | None = None, db: Session = Depends(get_db), _: NhanVien = Depends(require_manager)):
    reset_expired_temporary_sold_out(db)
    statement = select(MonAn).join(NhomMon)
    if category_id is not None:
        statement = statement.where(MonAn.nhom_mon_id == category_id)
    statement = statement.order_by(MonAn.nhom_mon_id.asc(), MonAn.id.asc())
    return [dish_to_dict(dish) for dish in db.scalars(statement).all()]


@router.get("/daily", response_model=list[MonAnResponse])
def list_daily_dishes(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_roles("BEP", "QUAN_LY")),
):
    reset_expired_temporary_sold_out(db)
    statement = select(MonAn).join(NhomMon).order_by(
        MonAn.nhom_mon_id.asc(),
        MonAn.id.asc(),
    )
    return [dish_to_dict(dish) for dish in db.scalars(statement).all()]


@router.get("/orderable", response_model=list[MonAnResponse])
def list_orderable_dishes(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_roles("PHUC_VU", "QUAN_LY")),
):
    reset_expired_temporary_sold_out(db)
    statement = (
        select(MonAn)
        .join(NhomMon)
        .where(
            NhomMon.dang_su_dung.is_(True),
            MonAn.trang_thai.in_(["DANG_BAN", "TAM_HET"]),
        )
        .order_by(NhomMon.thu_tu.asc(), MonAn.id.asc())
    )
    return [dish_to_dict(dish) for dish in db.scalars(statement).all()]


@router.get("/public", response_model=list[MonAnResponse])
def list_public_dishes(db: Session = Depends(get_db)):
    reset_expired_temporary_sold_out(db)
    statement = (
        select(MonAn).join(NhomMon)
        .where(NhomMon.dang_su_dung.is_(True), MonAn.trang_thai == "DANG_BAN")
        .order_by(NhomMon.thu_tu.asc(), MonAn.id.asc())
    )
    return [dish_to_dict(dish) for dish in db.scalars(statement).all()]


@router.post("", response_model=MonAnResponse, status_code=status.HTTP_201_CREATED)
def create_dish_endpoint(payload: MonAnCreate, db: Session = Depends(get_db), current_user: NhanVien = Depends(require_manager)):
    dish = create_dish(db, payload)
    db.commit()
    db.refresh(dish)
    return dish_to_dict(dish)


@router.patch("/{dish_id}", response_model=MonAnResponse)
def update_dish_endpoint(dish_id: int, payload: MonAnUpdate, request: Request, db: Session = Depends(get_db), current_user: NhanVien = Depends(require_manager)):
    existing = get_dish(db, dish_id)
    old_price = existing.gia
    dish = update_dish(db, dish_id, payload)

    if payload.gia is not None and payload.gia != old_price:
        db.add(NhatKyThaoTac(
            nhan_vien_id=current_user.id,
            hanh_dong="CAP_NHAT_GIA_MON",
            doi_tuong="MON_AN",
            doi_tuong_id=dish.id,
            du_lieu_cu={"gia": str(old_price)},
            du_lieu_moi={"gia": str(payload.gia)},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        ))
    db.commit()
    db.refresh(dish)
    return dish_to_dict(dish)


@router.post("/{dish_id}/image", response_model=MonAnResponse)
async def upload_dish_image(dish_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: NhanVien = Depends(require_manager)):
    dish = get_dish(db, dish_id)
    old = dish.anh_url
    dish.anh_url = await save_image(file, "dishes")
    if old != dish.anh_url:
        delete_image(old)
    db.commit()
    db.refresh(dish)
    return dish_to_dict(dish)


@router.delete("/{dish_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dish_endpoint(dish_id: int, db: Session = Depends(get_db), current_user: NhanVien = Depends(require_manager)):
    delete_dish(db, dish_id)
    db.commit()
    return None


@router.patch("/{dish_id}/temporary-sold-out", response_model=MonAnAvailabilityResponse)
def toggle_temporary_sold_out(
    dish_id: int,
    payload: MonAnAvailabilityUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(require_roles("BEP", "QUAN_LY")),
):
    reset_expired_temporary_sold_out(db)
    dish = get_dish(db, dish_id)
    old_status = dish.trang_thai

    set_temporary_sold_out(db, dish, payload.tam_het)

    if old_status != dish.trang_thai:
        db.add(
            NhatKyThaoTac(
                nhan_vien_id=current_user.id,
                hanh_dong="BAT_TAT_TAM_HET",
                doi_tuong="MON_AN",
                doi_tuong_id=dish.id,
                du_lieu_cu={
                    "trang_thai": old_status,
                },
                du_lieu_moi={
                    "trang_thai": dish.trang_thai,
                },
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        )

    db.commit()
    db.refresh(dish)

    return MonAnAvailabilityResponse(
        id=dish.id,
        ten_mon=dish.ten_mon,
        trang_thai=dish.trang_thai,
        tam_het=dish.trang_thai == "TAM_HET",
    )
