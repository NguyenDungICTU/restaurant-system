from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DatBanCreate(BaseModel):
    ho_ten_khach: str = Field(min_length=1, max_length=100)
    so_dien_thoai: str = Field(pattern=r"^0\d{9}$")
    so_luong_khach: int = Field(ge=1, le=30)
    ngay_dat: date
    gio_bat_dau: time
    khu_vuc_yeu_cau_id: int | None = Field(default=None, gt=0)
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
    ly_do_tu_choi: str | None = None
    thong_bao_khach: str | None = None
    thong_bao_gui_luc: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatBanHomNayResponse(BaseModel):
    id: int
    ma_dat_ban: str
    ho_ten_khach: str
    so_dien_thoai_da_che: str
    so_luong_khach: int
    khung_gio: str
    ten_ban: str | None = None
    trang_thai: str
    sap_den_trong_30_phut: bool
    co_the_doi_ban: bool
    khu_vuc_yeu_cau_id: int | None = None


class XacNhanDatBan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ban_id: int = Field(gt=0)


class TuChoiDatBan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ly_do: Literal[
        "HET_BAN",
        "NGOAI_GIO_PHUC_VU",
        "KHONG_LIEN_LAC_DUOC",
    ]


class DoiBanDatBan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ban_id: int = Field(gt=0)


class TraCuuDatBanResponse(BaseModel):
    ma_dat_ban: str
    ho_ten_khach: str
    so_dien_thoai_da_che: str
    ngay_dat: date
    gio_bat_dau: time
    so_luong_khach: int
    trang_thai: str
    ten_ban: str | None = None
    ly_do_tu_choi: str | None = None
    ly_do_tu_choi_hien_thi: str | None = None
    thong_bao_khach: str | None = None
    thong_bao_gui_luc: datetime | None = None
