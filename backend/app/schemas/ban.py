from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BanPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ma_ban: str = Field(min_length=1, max_length=50)
    khu_vuc_id: int = Field(gt=0)
    suc_chua_toi_thieu: int = Field(ge=1, le=2147483647)
    suc_chua_toi_da: int = Field(ge=1, le=2147483647)
    loai_ban: Literal["THUONG", "PHONG_RIENG"] = "THUONG"
    trang_thai: Literal["TRONG", "DANG_SU_DUNG", "DA_DAT", "NGUNG_SU_DUNG"] = "TRONG"

    @field_validator("ma_ban", mode="before")
    @classmethod
    def normalize_code(cls, value):
        return value.strip().upper() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_capacity(self):
        if self.suc_chua_toi_da < self.suc_chua_toi_thieu:
            raise ValueError("Sức chứa tối đa phải lớn hơn hoặc bằng tối thiểu.")
        return self


class BanResponse(BanPayload):
    model_config = ConfigDict(from_attributes=True)
    id: int
    qr_token: str
    created_at: datetime
    updated_at: datetime


class BanScanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ma_ban: str
    khu_vuc_id: int
    suc_chua_toi_thieu: int
    suc_chua_toi_da: int
    loai_ban: str
    trang_thai: str
