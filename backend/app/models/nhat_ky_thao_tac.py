from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class NhatKyThaoTac(Base):
    __tablename__ = "nhat_ky_thao_tac"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    nhan_vien_id: Mapped[int] = mapped_column(
        ForeignKey("nhan_vien.id"),
        nullable=False,
        index=True,
    )

    hanh_dong: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    doi_tuong: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    doi_tuong_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    du_lieu_cu: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    du_lieu_moi: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    user_agent: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )