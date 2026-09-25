
from datetime import date, time

from sqlalchemy import Boolean, Date, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class LichHoatDong(Base):
    __tablename__ = "lich_hoat_dong"

    thu: Mapped[int] = mapped_column(
        Integer, primary_key=True
    )

    la_ngay_nghi: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    gio_mo_cua: Mapped[time | None] = mapped_column(
        Time, nullable=True
    )

    gio_dong_cua: Mapped[time | None] = mapped_column(
        Time, nullable=True
    )


class NgayNghiDacBiet(Base):
    __tablename__ = "ngay_nghi_dac_biet"

    ngay: Mapped[date] = mapped_column(
        Date, primary_key=True
    )

    ten_ngay_nghi: Mapped[str] = mapped_column(
        String(150), nullable=False
    )


class CauHinhDatBan(Base):
    __tablename__ = "cau_hinh_dat_ban"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True
    )

    thoi_luong_giu_ban: Mapped[int] = mapped_column(
        Integer, nullable=False, default=90
    )
