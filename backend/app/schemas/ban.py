from pydantic import BaseModel, ConfigDict, Field, field_validator


class BanCreate(BaseModel):
    ten_ban: str = Field(min_length=1, max_length=50)
    so_cho: int = Field(ge=1, le=30)
    khu_vuc_id: int | None = Field(default=None, ge=1)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    @field_validator("ten_ban")
    @classmethod
    def require_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Tên bàn không được để trống.")
        return value


class BanResponse(BanCreate):
    id: int
    hoat_dong: bool

    model_config = ConfigDict(from_attributes=True)


class BanStatusUpdate(BaseModel):
    hoat_dong: bool


class XacNhanDatBan(BaseModel):
    ban_id: int = Field(ge=1)
