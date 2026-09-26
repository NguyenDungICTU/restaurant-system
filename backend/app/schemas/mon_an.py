from decimal import Decimal

from pydantic import BaseModel, Field


class MonAnCreate(BaseModel):
    ten_mon: str = Field(min_length=1, max_length=150)
    nhom_mon_id: int = Field(gt=0)
    gia: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    trang_thai: str = Field(default="DANG_BAN", min_length=1, max_length=30)
    anh_url: str | None = Field(default=None, max_length=500)


class MonAnUpdate(BaseModel):
    ten_mon: str | None = Field(default=None, min_length=1, max_length=150)
    nhom_mon_id: int | None = Field(default=None, gt=0)
    gia: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    trang_thai: str | None = Field(default=None, min_length=1, max_length=30)
    anh_url: str | None = Field(default=None, max_length=500)


class MonAnResponse(BaseModel):
    id: int
    ten_mon: str
    nhom_mon_id: int
    nhom_mon_ten: str
    gia: Decimal
    trang_thai: str
    anh_url: str

    model_config = {"from_attributes": True}
