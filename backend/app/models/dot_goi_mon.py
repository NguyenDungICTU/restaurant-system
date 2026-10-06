from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class DotGoiMon(Base):
    __tablename__ = "dot_goi_mon"
    __table_args__ = (
        UniqueConstraint("phien_ban_id", "so_dot", name="uq_dot_goi_mon_phien_so_dot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phien_ban_id: Mapped[int] = mapped_column(
        ForeignKey("phien_ban.id", ondelete="CASCADE"), nullable=False, index=True
    )
    so_dot: Mapped[int] = mapped_column(Integer, nullable=False)
    gui_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("nhan_vien.id", ondelete="SET NULL"), nullable=True
    )
