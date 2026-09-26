from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class DatBan(Base):
    __tablename__ = "dat_ban"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ten_khach: Mapped[str] = mapped_column(String(100), nullable=False)
    so_dien_thoai: Mapped[str] = mapped_column(String(20), nullable=False)
    so_khach: Mapped[int] = mapped_column(Integer, nullable=False)
    bat_dau_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    thoi_luong_phut: Mapped[int] = mapped_column(Integer, nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    trang_thai: Mapped[str] = mapped_column(
        String(30), nullable=False, default="CHO_XAC_NHAN", server_default="CHO_XAC_NHAN"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
