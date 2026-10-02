from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class ThongBao(Base):
    __tablename__ = "thong_bao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dat_ban_id: Mapped[int] = mapped_column(ForeignKey("dat_ban.id", ondelete="CASCADE"), nullable=False, index=True)
    loai: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="CHO_GUI")
    so_lan_thu: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lan_thu_cuoi_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lan_tiep_theo_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    da_gui_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    loi_cuoi: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
