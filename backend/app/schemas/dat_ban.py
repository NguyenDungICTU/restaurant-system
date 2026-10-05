from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DatBanCreate(BaseModel):
    ho_ten_khach: str = Field(min_length=1, max_length=100)
    so_dien_thoai: str = Field(pattern=r"^0\d{9}$")
    so_luong_khach: int = Field(ge=1, le=20)
    ngay_dat: date
    gio_bat_dau: time
    khu_vuc_id: int | None = Field(default=None, gt=0)
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
    ma_dat_ban: str
    thoi_luong_giu_ban: int
    trang_thai: str
    ban_id: int | None = None
    ten_ban: str | None = None
    email: str | None = None
    ly_do_tu_choi: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class XacNhanDatBan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ban_id: int = Field(gt=0)
class PublicTimeSlot(BaseModel):
    gio: str
    kha_dung: bool
    ly_do: str | None = None


class PublicTimeSlotsResponse(BaseModel):
    ngay: date
    gio_mo_cua: str | None = None
    gio_dong_cua: str | None = None
    thoi_luong_giu_ban: int = 90
    khung_gio: list[PublicTimeSlot] = Field(default_factory=list)
    ly_do: str | None = None


class PublicBookingResponse(BaseModel):
    ma_dat_ban: str
    ho_ten_khach: str
    so_dien_thoai: str
    so_luong_khach: int
    ngay_dat: date
    gio_bat_dau: time
    thoi_luong_giu_ban: int
    ten_khu_vuc: str | None = None
    ghi_chu: str | None = None
    trang_thai: str
    email: str | None = None
    ten_ban: str | None = None


class PublicBookingCreate(BaseModel):
    ho_ten_khach: str = Field(min_length=1, max_length=100)
    so_dien_thoai: str = Field(pattern=r"^0\d{9}$")
    email: str = Field(min_length=5, max_length=254)
    so_luong_khach: int = Field(ge=1, le=20)
    ngay_dat: date
    gio_bat_dau: time
    khu_vuc_id: int | None = Field(default=None, gt=0)
    ghi_chu: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("ho_ten_khach")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Tên khách không được để trống.")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip()
        if "@" not in value or "." not in value.rsplit("@", 1)[-1]:
            raise ValueError("Email không hợp lệ.")
        return value

    @field_validator("gio_bat_dau")
    @classmethod
    def validate_local_time(cls, value: time) -> time:
        if value.tzinfo is not None or value.second or value.microsecond:
            raise ValueError("Giờ bắt đầu chỉ nhận định dạng HH:MM theo giờ Việt Nam.")
        return value


class PublicBookingLookupResponse(BaseModel):
    id: int
    ma_dat_ban: str
    ho_ten_khach: str
    so_dien_thoai: str
    email: str | None = None
    so_luong_khach: int
    ngay_dat: date
    gio_bat_dau: time
    thoi_luong_giu_ban: int
    trang_thai: str
    ten_khu_vuc: str | None = None
    ten_ban: str | None = None
    ghi_chu: str | None = None
    co_the_huy: bool
    phut_con_lai: int
    so_dien_thoai_quan: str | None = None
    thong_bao_huy: str | None = None

class DatBanChoNhanKhachResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ho_ten_khach: str
    so_luong_khach: int
    ngay_dat: date
    gio_bat_dau: time


class NhanKhachBanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dat_ban_id: int | None = Field(default=None, gt=0)
    ho_ten_khach: str | None = Field(default=None, min_length=1, max_length=100)
    so_luong_khach: int | None = Field(default=None, ge=1, le=2147483647)
