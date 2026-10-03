from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BanConfigurationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    suc_chua_toi_thieu: int = Field(ge=1, le=2147483647)
    suc_chua_toi_da: int = Field(ge=1, le=2147483647)
    loai_ban: Literal["THUONG", "PHONG_RIENG"]

    @model_validator(mode="after")
    def validate_capacity(self):
        if self.suc_chua_toi_da < self.suc_chua_toi_thieu:
            raise ValueError("Sức chứa tối đa phải lớn hơn hoặc bằng tối thiểu.")
        return self


class BanCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    khu_vuc_id: int = Field(gt=0)


class BanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # id: int
    ma_ban: str
    khu_vuc_id: int
    suc_chua_toi_thieu: int | None
    suc_chua_toi_da: int | None
    loai_ban: Literal["THUONG", "PHONG_RIENG"] | None
    trang_thai: Literal["TRONG", "DANG_SU_DUNG", "DA_DAT", "DANG_DON", "NGUNG_SU_DUNG"]
    da_cau_hinh: bool
    qr_token: str
    created_at: datetime
    updated_at: datetime


class UpcomingTableBookingResponse(BaseModel):
    id: int
    ho_ten_khach: str
    so_luong_khach: int
    thoi_gian_den_at: datetime


class SeatedGuestResponse(BaseModel):
    ho_ten_khach: str
    so_luong_khach: int


class BanDetailsResponse(BanResponse):
    khach_dang_ngoi: SeatedGuestResponse | None
    bat_dau_phuc_vu_at: datetime | None
    tam_tinh_hien_tai: Decimal | None
    dat_ban_sap_toi: UpcomingTableBookingResponse | None


class BanCodeAvailabilityResponse(BaseModel):
    available: bool
    normalized_code: str
    
class BanScanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ma_ban: str
    khu_vuc_id: int
    suc_chua_toi_thieu: int | None
    suc_chua_toi_da: int | None
    loai_ban: str | None
    trang_thai: str
