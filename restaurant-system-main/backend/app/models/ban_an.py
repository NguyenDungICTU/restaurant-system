from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class BanAn(Base):
    __tablename__ = "ban_an"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ma_ban: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    khu_vuc_id: Mapped[int] = mapped_column(
        ForeignKey("khu_vuc.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    suc_chua_toi_thieu: Mapped[int] = mapped_column(Integer, nullable=False)
    suc_chua_toi_da: Mapped[int] = mapped_column(Integer, nullable=False)
    loai_ban: Mapped[str] = mapped_column(String(20), nullable=False)
    trang_thai: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="TRONG",
        server_default="TRONG",
    )
    qr_token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
