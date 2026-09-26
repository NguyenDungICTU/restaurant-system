from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class GioHoatDong(Base):
    __tablename__ = "gio_hoat_dong"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thu_trong_tuan: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    ngay_nghi: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gio_mo_cua: Mapped[time | None] = mapped_column(Time, nullable=True)
    gio_dong_cua: Mapped[time | None] = mapped_column(Time, nullable=True)


class CauHinhDatBan(Base):
    __tablename__ = "cau_hinh_dat_ban"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thoi_luong_phut: Mapped[int] = mapped_column(
        Integer, nullable=False, default=90, server_default="90"
    )


class NgayNghiDacBiet(Base):
    __tablename__ = "ngay_nghi_dac_biet"
    __table_args__ = (UniqueConstraint("ngay", name="uq_ngay_nghi_dac_biet_ngay"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
