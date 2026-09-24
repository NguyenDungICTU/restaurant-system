from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.models.nhan_vien import NhanVien
from app.models.nhom_mon import NhomMon
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.schemas.nhom_mon import (
    NhomMonCreate,
    NhomMonReorderRequest,
    NhomMonResponse,
    NhomMonStatusUpdate,
    NhomMonUpdate,
)
from app.services.image_service import save_image
from app.services.nhom_mon_service import (
    change_status,
    create_category,
    delete_category,
    get_category,
    reorder_categories,
    update_category,
)


router = APIRouter(
    prefix="/api/menu/categories",
    tags=["Menu Categories"],
)


def create_audit_log(
    db: Session,
    *,
    current_user: NhanVien,
    action: str,
    object_id: int | None,
    old_data: dict | None,
    new_data: dict | None,
    request: Request,
) -> None:

    log = NhatKyThaoTac(
        nhan_vien_id=current_user.id,
        hanh_dong=action,
        doi_tuong="NHOM_MON",
        doi_tuong_id=object_id,
        du_lieu_cu=old_data,
        du_lieu_moi=new_data,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
    )

    db.add(log)


def category_to_dict(
    category: NhomMon,
) -> dict:

    return {
        "id": category.id,
        "ten_nhom": category.ten_nhom,
        "thu_tu": category.thu_tu,
        "dang_su_dung": category.dang_su_dung,
        "anh_url": category.anh_url,
    }


# ============================================================
# PUBLIC
# ============================================================

@router.get(
    "/public",
    response_model=list[NhomMonResponse],
)
def get_public_categories(
    db: Session = Depends(get_db),
):
    """
    Single source of truth for menu category ordering.

    Used by:
    - public customer menu
    - waiter ordering screen
    """

    statement = (
        select(NhomMon)
        .where(
            NhomMon.dang_su_dung.is_(True)
        )
        .order_by(
            NhomMon.thu_tu.asc(),
            NhomMon.id.asc(),
        )
    )

    return list(
        db.scalars(statement).all()
    )


# ============================================================
# MANAGER
# ============================================================

@router.get(
    "",
    response_model=list[NhomMonResponse],
)
def list_categories(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    statement = (
        select(NhomMon)
        .order_by(
            NhomMon.thu_tu.asc(),
            NhomMon.id.asc(),
        )
    )

    return list(
        db.scalars(statement).all()
    )


@router.post(
    "",
    response_model=NhomMonResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_category_endpoint(
    payload: NhomMonCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(
        require_manager
    ),
):

    category = create_category(
        db,
        payload,
    )

    create_audit_log(
        db,
        current_user=current_user,
        action="CREATE",
        object_id=category.id,
        old_data=None,
        new_data=category_to_dict(category),
        request=request,
    )

    db.commit()
    db.refresh(category)

    return category


@router.patch(
    "/{category_id}",
    response_model=NhomMonResponse,
)
def update_category_endpoint(
    category_id: int,
    payload: NhomMonUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(
        require_manager
    ),
):

    category = get_category(
        db,
        category_id,
    )

    old_data = category_to_dict(
        category
    )

    category = update_category(
        db,
        category_id,
        payload,
    )

    new_data = category_to_dict(
        category
    )

    create_audit_log(
        db,
        current_user=current_user,
        action="UPDATE",
        object_id=category.id,
        old_data=old_data,
        new_data=new_data,
        request=request,
    )

    db.commit()

    return category


@router.patch(
    "/{category_id}/status",
    response_model=NhomMonResponse,
)
def update_category_status_endpoint(
    category_id: int,
    payload: NhomMonStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(
        require_manager
    ),
):

    category = get_category(
        db,
        category_id,
    )

    old_data = category_to_dict(
        category
    )

    category = change_status(
        db,
        category_id,
        payload.dang_su_dung,
    )

    new_data = category_to_dict(
        category
    )

    create_audit_log(
        db,
        current_user=current_user,
        action="STATUS_CHANGE",
        object_id=category.id,
        old_data=old_data,
        new_data=new_data,
        request=request,
    )

    db.commit()

    return category


@router.put(
    "/reorder",
    response_model=list[NhomMonResponse],
)
def reorder_category_endpoint(
    payload: NhomMonReorderRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(
        require_manager
    ),
):

    old_categories = list(
        db.scalars(
            select(NhomMon).order_by(
                NhomMon.thu_tu.asc()
            )
        ).all()
    )

    old_data = [
        category_to_dict(category)
        for category in old_categories
    ]

    categories = reorder_categories(
        db,
        payload,
    )

    new_data = [
        category_to_dict(category)
        for category in categories
    ]

    create_audit_log(
        db,
        current_user=current_user,
        action="REORDER",
        object_id=None,
        old_data={
            "categories": old_data
        },
        new_data={
            "categories": new_data
        },
        request=request,
    )

    db.commit()

    return categories


@router.post("/{category_id}/image", response_model=NhomMonResponse)
async def upload_category_image(
    category_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(require_manager),
):
    category = get_category(db, category_id)
    category.anh_url = await save_image(file, "categories")
    db.commit()
    db.refresh(category)
    return category


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_category_endpoint(
    category_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(
        require_manager
    ),
):

    category = get_category(
        db,
        category_id,
    )

    old_data = category_to_dict(
        category
    )

    delete_category(
        db,
        category_id,
    )

    create_audit_log(
        db,
        current_user=current_user,
        action="DELETE",
        object_id=category_id,
        old_data=old_data,
        new_data=None,
        request=request,
    )

    db.commit()

    return None