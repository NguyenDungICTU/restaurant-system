from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.ban_an import BanAn
from app.models.don_hang import ChiTietDonHang, DonHang
from app.models.mon_an import MonAn
from app.models.nhan_vien import NhanVien
from app.models.nhom_mon import NhomMon
from app.schemas.orders import (
    OrderCreate,
    OrderItemCreate,
    OrderItemResponse,
    OrderResponse,
    OrderStatusUpdate,
)


router = APIRouter(prefix="/api/orders", tags=["Orders"])


def order_response(order: DonHang) -> OrderResponse:
    items = [
        OrderItemResponse(
            id=item.id,
            dish_id=item.mon_an_id,
            dish_name=item.ten_mon_tai_thoi_diem_goi,
            unit_price=item.gia_tai_thoi_diem_goi,
            quantity=item.so_luong,
            total=item.gia_tai_thoi_diem_goi * item.so_luong,
        )
        for item in order.chi_tiet
    ]
    return OrderResponse(
        id=order.id,
        table_id=order.ban_an_id,
        created_by=order.nhan_vien_id,
        status=order.trang_thai,
        created_at=order.created_at,
        items=items,
        total=sum(item.total for item in items),
    )


def get_order(db: Session, order_id: int) -> DonHang:
    order = db.get(DonHang, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy order.")
    return order


@router.get("", response_model=list[OrderResponse])
def list_orders(
    status: str | None = None,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(get_current_user),
):
    statement = select(DonHang).order_by(DonHang.created_at.desc())
    if status:
        statement = statement.where(DonHang.trang_thai == status)
    return [order_response(row) for row in db.scalars(statement).all()]


@router.post("", response_model=OrderResponse, status_code=201)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    employee: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
):
    table = db.scalar(
        select(BanAn).where(BanAn.id == payload.table_id).with_for_update()
    )
    if table is None or table.trang_thai == "TAM_NGUNG":
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn đang hoạt động.")
    existing = db.scalar(
        select(DonHang)
        .where(
            DonHang.ban_an_id == table.id,
            DonHang.trang_thai.in_(("DANG_MO", "DANG_CHE_BIEN", "SAN_SANG", "DA_PHUC_VU")),
        )
        .with_for_update()
    )
    if existing is not None:
        return order_response(existing)

    order = DonHang(ban_an_id=table.id, nhan_vien_id=employee.id)
    db.add(order)
    if table.trang_thai == "TRONG":
        table.trang_thai = "DANG_PHUC_VU"
    db.commit()
    db.refresh(order)
    return order_response(order)


@router.post("/{order_id}/items", response_model=OrderResponse)
def add_order_item(
    order_id: int,
    payload: OrderItemCreate,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
):
    order = get_order(db, order_id)
    if order.trang_thai != "DANG_MO":
        raise HTTPException(status_code=409, detail="Order không còn ở trạng thái mở.")
    dish = db.scalar(
        select(MonAn)
        .join(NhomMon, MonAn.nhom_mon_id == NhomMon.id)
        .where(
            MonAn.id == payload.dish_id,
            MonAn.trang_thai == "DANG_BAN",
            MonAn.gia_ban.is_not(None),
            NhomMon.dang_su_dung.is_(True),
        )
    )
    if dish is None:
        raise HTTPException(status_code=409, detail="Món không còn được bán.")
    if dish.gia_ban is None:
        raise HTTPException(status_code=409, detail="Món chưa được thiết lập giá bán.")
    db.add(
        ChiTietDonHang(
            don_hang_id=order.id,
            mon_an_id=dish.id,
            ten_mon_tai_thoi_diem_goi=dish.ten_mon,
            gia_tai_thoi_diem_goi=dish.gia_ban,
            so_luong=payload.quantity,
        )
    )
    db.commit()
    db.refresh(order)
    return order_response(order)


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    employee: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU", "BEP", "THU_NGAN")),
):
    new_status = payload.status
    order = get_order(db, order_id)
    allowed_transitions = {
        ("DANG_MO", "DANG_CHE_BIEN"): {"QUAN_LY", "BEP"},
        ("DANG_CHE_BIEN", "SAN_SANG"): {"QUAN_LY", "BEP"},
        ("SAN_SANG", "DA_PHUC_VU"): {"QUAN_LY", "PHUC_VU"},
        ("DA_PHUC_VU", "DA_THANH_TOAN"): {"QUAN_LY", "THU_NGAN"},
        ("DANG_MO", "HUY"): {"QUAN_LY"},
        ("DANG_CHE_BIEN", "HUY"): {"QUAN_LY"},
        ("SAN_SANG", "HUY"): {"QUAN_LY"},
    }
    allowed_roles = allowed_transitions.get((order.trang_thai, new_status))
    if allowed_roles is None or employee.vai_tro not in allowed_roles:
        raise HTTPException(status_code=403, detail="Không được phép chuyển order sang trạng thái này.")
    order.trang_thai = new_status
    if new_status in {"DA_THANH_TOAN", "HUY"}:
        db.execute(
            update(BanAn)
            .where(BanAn.id == order.ban_an_id)
            .values(trang_thai="TRONG")
        )
    db.commit()
    db.refresh(order)
    return order_response(order)
