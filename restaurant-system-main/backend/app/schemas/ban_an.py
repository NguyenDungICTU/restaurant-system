from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BanAnCreate(BaseModel):
    ma_ban: str = Field(min_length=1, max_length=50)
    khu_vuc_id: int = Field(gt=0)
    suc_chua_toi_thieu: int = Field(ge=1)
    suc_chua_toi_da: int = Field(ge=1)
    loai_ban: Literal["THUONG", "PHONG_RIENG"]
    trang_thai: Literal["TRONG", "DANG_PHUC_VU", "DA_DAT", "TAM_NGUNG"] = "TRONG"

    @field_validator("ma_ban")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        value = " ".join(value.strip().split())
        if not value:
            raise ValueError("Mã bàn không được để trống.")
        return value

    @model_validator(mode="after")
    def validate_capacity(self):
        if self.suc_chua_toi_da < self.suc_chua_toi_thieu:
            raise ValueError("Sức chứa tối đa phải lớn hơn hoặc bằng sức chứa tối thiểu.")
        return self


class BanAnUpdate(BanAnCreate):
    pass


class BanAnResponse(BaseModel):
    id: int
    ma_ban: str
    khu_vuc_id: int
    suc_chua_toi_thieu: int
    suc_chua_toi_da: int
    loai_ban: str
    trang_thai: str

    model_config = ConfigDict(from_attributes=True)
