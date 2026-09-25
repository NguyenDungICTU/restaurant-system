from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class LichNgayInput(BaseModel):
    thu: int = Field(ge=0, le=6)
    la_ngay_nghi: bool = False
    gio_mo_cua: time | None = None
    gio_dong_cua: time | None = None

    @model_validator(mode="after")
    def validate_hours(self):
        if self.la_ngay_nghi:
            return self
        if self.gio_mo_cua is None or self.gio_dong_cua is None:
            raise ValueError("Ngày mở cửa phải có giờ mở và giờ đóng.")
        if self.gio_mo_cua.tzinfo or self.gio_dong_cua.tzinfo:
            raise ValueError("Giờ mở cửa/đóng cửa phải dùng giờ địa phương.")
        if self.gio_dong_cua <= self.gio_mo_cua:
            raise ValueError("Giờ đóng cửa phải sau giờ mở cửa.")
        return self


class LichTuanUpdate(BaseModel):
    ngay: list[LichNgayInput] = Field(min_length=7, max_length=7)

    @model_validator(mode="after")
    def validate_week(self):
        if {item.thu for item in self.ngay} != set(range(7)):
            raise ValueError("Lịch phải có đủ 7 ngày và không được trùng thứ.")
        return self


class CauHinhDatBanUpdate(BaseModel):
    thoi_luong_giu_ban: int = Field(ge=30, le=720, multiple_of=30)


class NgayNghiCreate(BaseModel):
    ngay: date
    ten_ngay_nghi: str = Field(min_length=1, max_length=150)
    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("ten_ngay_nghi")
    @classmethod
    def non_blank_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Tên ngày nghỉ không được để trống.")
        return value


class LichCauHinhUpdate(LichTuanUpdate, CauHinhDatBanUpdate):
    ngay_nghi: list[NgayNghiCreate] = Field(default_factory=list, max_length=366)

    @model_validator(mode="after")
    def unique_holidays(self):
        dates = [item.ngay for item in self.ngay_nghi]
        if len(dates) != len(set(dates)):
            raise ValueError("Ngày nghỉ đặc biệt không được trùng ngày.")
        return self
