from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Ban(Base):
    __tablename__ = "ban"
    __table_args__ = (
        CheckConstraint(
            "(da_cau_hinh AND suc_chua_toi_thieu IS NOT NULL "
            "AND suc_chua_toi_da IS NOT NULL AND suc_chua_toi_thieu >= 1 "
            "AND suc_chua_toi_da >= suc_chua_toi_thieu) "
            "OR (NOT da_cau_hinh AND suc_chua_toi_thieu IS NULL "
            "AND suc_chua_toi_da IS NULL)",
            name="ck_ban_suc_chua",
        ),
        CheckConstraint(
            "(da_cau_hinh AND loai_ban IS NOT NULL "
            "AND loai_ban IN ('THUONG', 'PHONG_RIENG')) "
            "OR (NOT da_cau_hinh AND loai_ban IS NULL)",
            name="ck_ban_loai",
        ),
        CheckConstraint("trang_thai IN ('TRONG', 'DANG_SU_DUNG', 'DA_DAT', 'DANG_DON', 'NGUNG_SU_DUNG')", name="ck_ban_trang_thai"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_ban: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    khu_vuc_id: Mapped[int] = mapped_column(ForeignKey("khu_vuc.id", ondelete="RESTRICT"), index=True)
    suc_chua_toi_thieu: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suc_chua_toi_da: Mapped[int | None] = mapped_column(Integer, nullable=True)
    loai_ban: Mapped[str | None] = mapped_column(String(20), nullable=True)
    da_cau_hinh: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )
    trang_thai: Mapped[str] = mapped_column(String(30), nullable=False, default="TRONG")
    trang_thai_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BanQRToken(Base):
    """Keep every issued token so an old QR remains recognizable after rotation."""
    __tablename__ = "ban_qr_token"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    ban_id: Mapped[int] = mapped_column(ForeignKey("ban.id", ondelete="RESTRICT"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
