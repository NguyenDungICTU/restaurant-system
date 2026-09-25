from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Ban(Base):
    __tablename__ = "ban"
    __table_args__ = (
        UniqueConstraint("ten_ban", name="uq_ban_ten_ban"),
        CheckConstraint("so_cho BETWEEN 1 AND 30", name="ck_ban_so_cho"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ten_ban: Mapped[str] = mapped_column(String(50), nullable=False)
    so_cho: Mapped[int] = mapped_column(Integer, nullable=False)
    khu_vuc_id: Mapped[int | None] = mapped_column(
        ForeignKey("khu_vuc.id", ondelete="RESTRICT"), nullable=True
    )
    hoat_dong: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
