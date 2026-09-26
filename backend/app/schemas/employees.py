import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


EmployeeRole = Literal["QUAN_LY", "PHUC_VU", "BEP", "THU_NGAN"]
EmployeeStatus = Literal["HOAT_DONG", "DA_NGHI"]


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=9, max_length=20)
    username: str = Field(min_length=3, max_length=50)
    role: EmployeeRole
    status: EmployeeStatus = "HOAT_DONG"

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        value = " ".join(value.strip().split())
        if len(value) < 2:
            raise ValueError("Họ tên không hợp lệ.")
        return value

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9._-]+", value):
            raise ValueError(
                "Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang."
            )
        return value

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        value = re.sub(r"[\s().-]", "", value.strip())
        if value.startswith("+84"):
            value = "0" + value[3:]
        if not re.fullmatch(r"0\d{8,10}", value):
            raise ValueError("Số điện thoại không hợp lệ.")
        return value


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str
    username: str
    role: EmployeeRole
    status: EmployeeStatus


class EmployeeCreatedResponse(EmployeeResponse):
    temporary_password: str = Field(
        description="Mật khẩu tạm chỉ xuất hiện trong response tạo tài khoản này."
    )
    message: str


class EmployeeStatusUpdate(BaseModel):
    status: EmployeeStatus


class AvailabilityResponse(BaseModel):
    available: bool
    field: Literal["username", "phone"]
    message: str | None = None
