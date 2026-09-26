from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class NhanVien(Base):
    __tablename__ = "nhan_vien"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    ten_dang_nhap: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    so_dien_thoai: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )

    mat_khau: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    ho_ten: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    vai_tro: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PHUC_VU",
    )

    trang_thai: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="HOAT_DONG",
    )

    doi_mat_khau_lan_dau: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    so_lan_dang_nhap_sai: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    cua_so_bat_dau_sai: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    khoa_den: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )