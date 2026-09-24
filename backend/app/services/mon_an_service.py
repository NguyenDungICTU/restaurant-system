from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mon_an import MonAn
from app.models.nhom_mon import NhomMon
from app.schemas.mon_an import MonAnCreate, MonAnUpdate

DISH_NOT_FOUND = "Không tìm thấy món ăn."
CATEGORY_NOT_FOUND = "Không tìm thấy nhóm món."
DISH_NAME_REQUIRED = "Tên món ăn không được để trống."


def normalize_name(name: str) -> str:
    return " ".join(name.strip().split())


def get_category(db: Session, category_id: int) -> NhomMon:
    category = db.get(NhomMon, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail=CATEGORY_NOT_FOUND)
    return category


def get_dish(db: Session, dish_id: int) -> MonAn:
    dish = db.get(MonAn, dish_id)
    if dish is None:
        raise HTTPException(status_code=404, detail=DISH_NOT_FOUND)
    return dish


def create_dish(db: Session, payload: MonAnCreate) -> MonAn:
    name = normalize_name(payload.ten_mon)
    if not name:
        raise HTTPException(status_code=422, detail=DISH_NAME_REQUIRED)
    get_category(db, payload.nhom_mon_id)
    dish = MonAn(
        ten_mon=name,
        nhom_mon_id=payload.nhom_mon_id,
        trang_thai=payload.trang_thai,
        anh_url=payload.anh_url or "/media/default-dish.svg",
    )
    db.add(dish)
    db.flush()
    db.refresh(dish)
    return dish


def update_dish(db: Session, dish_id: int, payload: MonAnUpdate) -> MonAn:
    dish = get_dish(db, dish_id)
    if payload.ten_mon is not None:
        name = normalize_name(payload.ten_mon)
        if not name:
            raise HTTPException(status_code=422, detail=DISH_NAME_REQUIRED)
        dish.ten_mon = name
    if payload.nhom_mon_id is not None:
        get_category(db, payload.nhom_mon_id)
        dish.nhom_mon_id = payload.nhom_mon_id
    if payload.trang_thai is not None:
        dish.trang_thai = payload.trang_thai
    if payload.anh_url is not None:
        dish.anh_url = payload.anh_url or "/media/default-dish.svg"
    db.flush()
    db.refresh(dish)
    return dish


def delete_dish(db: Session, dish_id: int) -> None:
    dish = get_dish(db, dish_id)
    db.delete(dish)
    db.flush()
