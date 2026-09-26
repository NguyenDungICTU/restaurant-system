from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Ban(Base):
    __tablename__ = "ban"
    __table_args__ = (
        CheckConstraint("suc_chua_toi_thieu >= 1 AND suc_chua_toi_da >= suc_chua_toi_thieu", name="ck_ban_suc_chua"),
        CheckConstraint("loai_ban IN ('THUONG', 'PHONG_RIENG')", name="ck_ban_loai"),
        CheckConstraint("trang_thai IN ('TRONG', 'DANG_SU_DUNG', 'DA_DAT', 'NGUNG_SU_DUNG')", name="ck_ban_trang_thai"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_ban: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    khu_vuc_id: Mapped[int] = mapped_column(ForeignKey("khu_vuc.id", ondelete="RESTRICT"), index=True)
    suc_chua_toi_thieu: Mapped[int] = mapped_column(Integer, nullable=False)
    suc_chua_toi_da: Mapped[int] = mapped_column(Integer, nullable=False)
    loai_ban: Mapped[str] = mapped_column(String(20), nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(30), nullable=False, default="TRONG")
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BanQRToken(Base):
    """Keep every issued token so an old QR remains recognizable after rotation."""
    __tablename__ = "ban_qr_token"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    ban_id: Mapped[int] = mapped_column(ForeignKey("ban.id", ondelete="RESTRICT"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
