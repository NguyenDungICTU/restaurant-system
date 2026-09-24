from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class KhuVucBase(BaseModel):
    ten_khu_vuc: str = Field(min_length=1, max_length=100)
    thu_tu_hien_thi: int = Field(default=0, ge=0)
    ghi_chu: str | None = Field(default=None, max_length=1000)

    @field_validator("ten_khu_vuc")
    @classmethod
    def chuan_hoa_ten(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Tên khu vực không được để trống")
        return value

    @field_validator("ghi_chu")
    @classmethod
    def chuan_hoa_ghi_chu(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class KhuVucCreate(KhuVucBase):
    pass


class KhuVucUpdate(KhuVucBase):
    pass


class KhuVucResponse(KhuVucBase):
    id: int
    trang_thai: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)