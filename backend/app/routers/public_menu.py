from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.mon_an import MonAn
from app.models.nhom_mon import NhomMon
from app.schemas.public_menu import PublicMenuCategory, PublicMenuDish, PublicMenuResponse

router = APIRouter(prefix="/api/menu", tags=["Public Menu"])


@router.get("/public", response_model=PublicMenuResponse)
def get_public_menu(db: Session = Depends(get_db)):
    """Public customer menu; no authentication required.

    TAM_HET is intentionally kept in the response so the frontend can render
    the dish with a temporary sold-out label instead of hiding it.
    NGUNG_BAN is excluded from the public menu.
    """
    categories = db.scalars(
        select(NhomMon)
        .where(NhomMon.dang_su_dung.is_(True))
        .order_by(NhomMon.thu_tu.asc(), NhomMon.id.asc())
    ).all()

    dishes = db.scalars(
        select(MonAn)
        .where(MonAn.trang_thai.in_(["DANG_BAN", "TAM_HET"]))
        .order_by(MonAn.nhom_mon_id.asc(), MonAn.id.asc())
    ).all()

    dishes_by_category: dict[int, list[PublicMenuDish]] = {}
    for dish in dishes:
        dishes_by_category.setdefault(dish.nhom_mon_id, []).append(
            PublicMenuDish(
                id=dish.id,
                ten_mon=dish.ten_mon,
                gia=dish.gia,
                don_vi_tinh=dish.don_vi_tinh,
                mo_ta_ngan=dish.mo_ta_ngan,
                anh_url=dish.anh_url,
                trang_thai=dish.trang_thai,
            )
        )

    return PublicMenuResponse(
        categories=[
            PublicMenuCategory(
                id=category.id,
                ten_nhom=category.ten_nhom,
                thu_tu=category.thu_tu,
                anh_url=category.anh_url,
                mon_an=dishes_by_category.get(category.id, []),
            )
            for category in categories
        ]
    )
