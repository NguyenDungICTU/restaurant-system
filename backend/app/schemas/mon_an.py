from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


MAX_PRICE = Decimal("50000000")


def validate_price(value: Decimal) -> Decimal:
    if value <= 0:
        raise ValueError("Giá bán phải là số nguyên dương.")
    if value != value.to_integral_value():
        raise ValueError("Giá bán phải là số nguyên VND.")
    if value > MAX_PRICE:
        raise ValueError("Giá bán không được vượt quá 50.000.000 VND.")
    return value


def validate_prep(value: int) -> int:
    if value < 1 or value > 1440:
        raise ValueError("Thời gian chế biến phải từ 1 đến 1440 phút.")
    return value


class MonAnCreate(BaseModel):
    ten_mon: str = Field(min_length=1, max_length=150)
    nhom_mon_id: int = Field(gt=0)
    gia: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    don_vi_tinh: str = Field(default="phần", min_length=1, max_length=30)
    mo_ta_ngan: str | None = Field(default=None, max_length=500)
    thoi_gian_che_bien_phut: int = Field(default=15, ge=1, le=1440)
    trang_thai: str = Field(default="DANG_BAN", min_length=1, max_length=30)
    anh_url: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    @field_validator("gia")
    @classmethod
    def check_price(cls, value: Decimal) -> Decimal:
        return validate_price(value)

    @field_validator("thoi_gian_che_bien_phut")
    @classmethod
    def check_prep(cls, value: int) -> int:
        return validate_prep(value)


class MonAnUpdate(BaseModel):
    ten_mon: str | None = Field(default=None, min_length=1, max_length=150)
    nhom_mon_id: int | None = Field(default=None, gt=0)
    gia: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    don_vi_tinh: str | None = Field(default=None, min_length=1, max_length=30)
    mo_ta_ngan: str | None = Field(default=None, max_length=500)
    thoi_gian_che_bien_phut: int | None = Field(default=None, ge=1, le=1440)
    trang_thai: str | None = Field(default=None, min_length=1, max_length=30)
    anh_url: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    @field_validator("gia")
    @classmethod
    def check_price(cls, value: Decimal) -> Decimal:
        return validate_price(value)

    @field_validator("thoi_gian_che_bien_phut")
    @classmethod
    def check_prep(cls, value: int) -> int:
        return validate_prep(value)


class MonAnResponse(BaseModel):
    id: int
    ten_mon: str
    nhom_mon_id: int
    nhom_mon_ten: str
    gia: Decimal
    don_vi_tinh: str
    mo_ta_ngan: str | None
    thoi_gian_che_bien_phut: int
    trang_thai: str
    anh_url: str

    model_config = ConfigDict(from_attributes=True)


class MonAnAvailabilityUpdate(BaseModel):
    tam_het: bool


class MonAnAvailabilityResponse(BaseModel):
    id: int
    ten_mon: str
    trang_thai: str
    tam_het: bool

