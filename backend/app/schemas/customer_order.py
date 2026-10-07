from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CustomerOrderItem(BaseModel):
    mon_an_id: int = Field(gt=0)
    so_luong: int = Field(ge=1, le=50)
    ghi_chu: str | None = Field(default=None, max_length=200)


class CustomerOrderCreate(BaseModel):
    qr_token: str = Field(min_length=10, max_length=100)
    phien_ban_id: int | None = Field(default=None, gt=0)
    items: list[CustomerOrderItem] = Field(min_length=1, max_length=30)


class StaffOrderCreate(BaseModel):
    items: list[CustomerOrderItem] = Field(min_length=1, max_length=30)


class CustomerTableResponse(BaseModel):
    qr_token: str
    ban_id: int
    ma_ban: str
    suc_chua_toi_thieu: int
    suc_chua_toi_da: int
    loai_ban: str
    status: str
    message: str
    can_order: bool
    reservation_at: datetime | None = None
    reservation_minutes: int | None = None
    phien_ban_id: int | None = None


class CustomerOrderLineResponse(BaseModel):
    id: int
    mon_an_id: int
    ten_mon: str
    so_luong: int
    don_gia: Decimal
    thanh_tien: Decimal
    ghi_chu: str | None
    trang_thai: str
    du_kien_hoan_thanh_at: datetime | None
    hoan_thanh_at: datetime | None = None
    phuc_vu_at: datetime | None = None
    tinh_tien: bool = True
    ly_do_huy: str | None = None
    huy_at: datetime | None = None


class CustomerOrderResponse(BaseModel):
    dot_id: int
    phien_ban_id: int
    ban_id: int
    ma_ban: str
    gui_at: datetime
    tong_tien: Decimal
    du_kien_hoan_thanh_at: datetime | None
    trang_thai: str
    lines: list[CustomerOrderLineResponse]


class StaffOrderLineResponse(BaseModel):
    id: int
    dot_id: int
    phien_ban_id: int
    ban_id: int
    ma_ban: str
    ten_mon: str
    so_luong: int
    don_gia: Decimal
    ghi_chu: str | None
    trang_thai: str
    thoi_diem_tiep_nhan: datetime
    du_kien_hoan_thanh_at: datetime | None
    hoan_thanh_at: datetime | None = None
    phuc_vu_at: datetime | None = None
    tinh_tien: bool = True
    ly_do_huy: str | None = None
    huy_at: datetime | None = None


class StaffOrderStatusUpdate(BaseModel):
    trang_thai: str


class CancelOrderLineRequest(BaseModel):
    ly_do_huy: str = Field(min_length=1, max_length=100)
