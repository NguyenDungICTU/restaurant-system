from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.mon_an import MonAn
from app.models.nhom_mon import NhomMon
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.schemas.nhom_mon import (
    NhomMonCreate,
    NhomMonReorderRequest,
    NhomMonUpdate,
)


CATEGORY_NOT_FOUND = "Không tìm thấy nhóm món."

DUPLICATE_CATEGORY_NAME = (
    "Tên nhóm món đã tồn tại."
)

CATEGORY_HAS_DISHES = (
    "Không thể xoá nhóm món đang chứa món. "
    "Vui lòng chuyển các món sang nhóm khác trước."
)


def normalize_name(name: str) -> str:
    return " ".join(name.strip().split())


def get_category(
    db: Session,
    category_id: int,
) -> NhomMon:

    category = db.get(
        NhomMon,
        category_id,
    )

    if category is None:
        raise HTTPException(
            status_code=404,
            detail=CATEGORY_NOT_FOUND,
        )

    return category


def validate_unique_name(
    db: Session,
    name: str,
    *,
    exclude_id: int | None = None,
) -> None:

    normalized = normalize_name(name)

    statement = select(NhomMon).where(
        func.lower(
            func.btrim(NhomMon.ten_nhom)
        ) == normalized.lower()
    )

    if exclude_id is not None:
        statement = statement.where(
            NhomMon.id != exclude_id
        )

    existing = db.scalar(statement)

    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=DUPLICATE_CATEGORY_NAME,
        )


def get_next_position(
    db: Session,
) -> int:

    max_position = db.scalar(
        select(
            func.max(NhomMon.thu_tu)
        )
    )

    return (max_position or 0) + 1


def create_category(
    db: Session,
    payload: NhomMonCreate,
) -> NhomMon:

    name = normalize_name(
        payload.ten_nhom
    )

    validate_unique_name(
        db,
        name,
    )

    category = NhomMon(
        ten_nhom=name,
        thu_tu=get_next_position(db),
        dang_su_dung=True,
        anh_url=payload.anh_url or "/media/default-category.svg",
    )

    db.add(category)

    try:
        db.flush()
        db.refresh(category)
    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=DUPLICATE_CATEGORY_NAME,
        )

    return category


def update_category(
    db: Session,
    category_id: int,
    payload: NhomMonUpdate,
) -> NhomMon:

    category = get_category(
        db,
        category_id,
    )

    if payload.ten_nhom is not None:

        name = normalize_name(
            payload.ten_nhom
        )

        validate_unique_name(
            db,
            name,
            exclude_id=category_id,
        )

        category.ten_nhom = name

    if payload.anh_url is not None:
        category.anh_url = payload.anh_url or "/media/default-category.svg"

    try:
        db.flush()
        db.refresh(category)
    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=DUPLICATE_CATEGORY_NAME,
        )

    return category


def change_status(
    db: Session,
    category_id: int,
    dang_su_dung: bool,
) -> NhomMon:

    category = get_category(
        db,
        category_id,
    )

    category.dang_su_dung = dang_su_dung

    db.flush()
    db.refresh(category)

    return category


def reorder_categories(
    db: Session,
    payload: NhomMonReorderRequest,
) -> list[NhomMon]:

    categories = db.scalars(
        select(NhomMon)
        .order_by(NhomMon.thu_tu.asc())
        .with_for_update()
    ).all()

    category_map = {
        category.id: category
        for category in categories
    }

    requested_ids = {
        item.id
        for item in payload.items
    }

    existing_ids = set(category_map.keys())

    if requested_ids != existing_ids:
        raise HTTPException(
            status_code=400,
            detail=(
                "Danh sách sắp xếp phải chứa "
                "đúng tất cả nhóm món."
            ),
        )

    # Two-phase update prevents transient
    # position collisions if a unique position
    # constraint is added later.
    temporary_offset = len(categories) + 1000

    for index, category in enumerate(
        categories,
        start=1,
    ):
        category.thu_tu = (
            temporary_offset + index
        )

    db.flush()

    for item in payload.items:
        category_map[item.id].thu_tu = (
            item.thu_tu
        )

    db.flush()

    return list(
        sorted(
            categories,
            key=lambda item: item.thu_tu,
        )
    )


def delete_category(
    db: Session,
    category_id: int,
) -> None:

    category = get_category(
        db,
        category_id,
    )

    has_dishes = db.scalar(
        select(
            select(MonAn.id)
            .where(
                MonAn.nhom_mon_id
                == category_id
            )
            .exists()
        )
    )

    if has_dishes:
        raise HTTPException(
            status_code=409,
            detail=CATEGORY_HAS_DISHES,
        )

    db.delete(category)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=CATEGORY_HAS_DISHES,
        )