from pydantic import BaseModel, Field


class MonAnCreate(BaseModel):
    ten_mon: str = Field(min_length=1, max_length=150)
    nhom_mon_id: int = Field(gt=0)
    gia_ban: int = Field(gt=0, le=50_000_000)
    don_vi_tinh: str = Field(min_length=1, max_length=30)
    mo_ta: str | None = Field(default=None, max_length=1000)
    thoi_gian_che_bien_phut: int = Field(ge=1, le=1440)
    trang_thai: str = Field(default="DANG_BAN", min_length=1, max_length=30)
    anh_url: str | None = Field(default=None, max_length=500)


class MonAnUpdate(BaseModel):
    ten_mon: str | None = Field(default=None, min_length=1, max_length=150)
    nhom_mon_id: int | None = Field(default=None, gt=0)
    gia_ban: int | None = Field(default=None, gt=0, le=50_000_000)
    don_vi_tinh: str | None = Field(default=None, min_length=1, max_length=30)
    mo_ta: str | None = Field(default=None, max_length=1000)
    thoi_gian_che_bien_phut: int | None = Field(default=None, ge=1, le=1440)
    trang_thai: str | None = Field(default=None, min_length=1, max_length=30)
    anh_url: str | None = Field(default=None, max_length=500)


class MonAnResponse(BaseModel):
    id: int
    ten_mon: str
    nhom_mon_id: int
    nhom_mon_ten: str
    gia_ban: int | None
    don_vi_tinh: str | None
    mo_ta: str | None
    thoi_gian_che_bien_phut: int | None
    trang_thai: str
    anh_url: str

    model_config = {"from_attributes": True}
