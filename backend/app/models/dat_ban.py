
from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.ban import Ban


class DatBan(Base):
    __tablename__ = "dat_ban"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )

    ho_ten_khach: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    so_dien_thoai: Mapped[str] = mapped_column(
        String(10), nullable=False
    )

    so_luong_khach: Mapped[int] = mapped_column(
        Integer, nullable=False
    )

    ngay_dat: Mapped[date] = mapped_column(
        Date, nullable=False
    )

    gio_bat_dau: Mapped[time] = mapped_column(
        Time, nullable=False
    )

    thoi_luong_giu_ban: Mapped[int] = mapped_column(
        Integer, nullable=False, default=90
    )

    trang_thai: Mapped[str] = mapped_column(
        String(30), nullable=False, default="CHO_XAC_NHAN"
    )

    ban_id: Mapped[int | None] = mapped_column(ForeignKey("ban.id", ondelete="RESTRICT"), nullable=True)
    ban: Mapped[Ban | None] = relationship()

    @property
    def ten_ban(self) -> str | None:
        return self.ban.ten_ban if self.ban else None

    ghi_chu: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
