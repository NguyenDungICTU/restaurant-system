from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DatBanCreate(BaseModel):
    ho_ten_khach: str = Field(min_length=1, max_length=100)
    so_dien_thoai: str = Field(pattern=r"^0\d{9}$")
    so_luong_khach: int = Field(ge=1, le=30)
    ngay_dat: date
    gio_bat_dau: time
    ghi_chu: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("ho_ten_khach")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Tên khách không được để trống.")
        return value

    @field_validator("gio_bat_dau")
    @classmethod
    def validate_local_time(cls, value: time) -> time:
        if value.tzinfo is not None or value.second or value.microsecond:
            raise ValueError("Giờ bắt đầu chỉ nhận định dạng HH:MM theo giờ Việt Nam.")
        return value


class DatBanResponse(DatBanCreate):
    id: int
    thoi_luong_giu_ban: int
    trang_thai: str
    ban_id: int | None = None
    ten_ban: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
