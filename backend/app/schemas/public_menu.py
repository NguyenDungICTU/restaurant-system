from decimal import Decimal

from pydantic import BaseModel


class PublicMenuDish(BaseModel):
    id: int
    ten_mon: str
    gia: Decimal
    don_vi_tinh: str
    mo_ta_ngan: str | None
    anh_url: str
    trang_thai: str


class PublicMenuCategory(BaseModel):
    id: int
    ten_nhom: str
    thu_tu: int
    anh_url: str
    mon_an: list[PublicMenuDish]


class PublicMenuResponse(BaseModel):
    categories: list[PublicMenuCategory]
