from datetime import date, time
from pydantic import BaseModel, Field, model_validator


class DailyHoursInput(BaseModel):
    weekday: int = Field(ge=0, le=6)
    is_closed: bool
    open_time: time | None = None
    close_time: time | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.is_closed:
            if self.open_time is not None or self.close_time is not None:
                raise ValueError("Ngày nghỉ không nhận giờ mở/đóng cửa.")
        elif (
            self.open_time is None
            or self.close_time is None
            or self.close_time <= self.open_time
        ):
            raise ValueError("Giờ đóng cửa phải sau giờ mở cửa.")
        return self


class WeeklyHoursUpdate(BaseModel):
    days: list[DailyHoursInput] = Field(min_length=7, max_length=7)
    reservation_duration_minutes: int = Field(ge=30, le=720)

    @model_validator(mode="after")
    def validate_week(self):
        weekdays = [day.weekday for day in self.days]
        if set(weekdays) != set(range(7)):
            raise ValueError("Lịch tuần phải có đủ bảy ngày, không lặp ngày.")
        return self


class DailyHoursResponse(BaseModel):
    weekday: int
    is_closed: bool
    open_time: time | None
    close_time: time | None


class WeeklyHoursResponse(BaseModel):
    days: list[DailyHoursResponse]
    reservation_duration_minutes: int


class HolidayCreate(BaseModel):
    date: date
    note: str | None = Field(default=None, max_length=255)


class HolidayResponse(BaseModel):
    id: int
    date: date
    note: str | None


class ReservationCreate(BaseModel):
    guest_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=9, max_length=20)
    guests: int = Field(ge=1, le=100)
    reservation_date: date
    reservation_time: time
    note: str | None = Field(default=None, max_length=1000)


class ReservationResponse(BaseModel):
    id: int
    guest_name: str
    phone: str
    guests: int
    starts_at: str
    duration_minutes: int
    note: str | None
    status: str


class AvailableSlotsResponse(BaseModel):
    date: date
    time_slots: list[time]
    closed: bool
    message: str | None
