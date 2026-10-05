from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class PhienBan(Base):
    __tablename__ = "phien_ban"
    __table_args__ = (
        CheckConstraint(
            "trang_thai IN ('DANG_PHUC_VU', 'CHO_THANH_TOAN', 'DA_DONG', 'DA_GOP')",
            name="ck_phien_ban_trang_thai",
        ),
        Index("ix_phien_ban_ban_id_trang_thai", "ban_id", "trang_thai"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ban_id: Mapped[int] = mapped_column(
        ForeignKey("ban.id", ondelete="RESTRICT"),
        nullable=False,
    )
    ho_ten_khach: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    so_luong_khach: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="DANG_PHUC_VU",
        server_default="DANG_PHUC_VU",
    )
    bat_dau_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    cho_thanh_toan_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    dong_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("nhan_vien.id", ondelete="SET NULL"),
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
    phien_chinh_id: Mapped[int | None] = mapped_column(
        ForeignKey("phien_ban.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
