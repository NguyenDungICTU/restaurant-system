from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class NhomMon(Base):
    __tablename__ = "nhom_mon"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    ten_nhom: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    anh_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        default="/media/default-category.svg",
        server_default="/media/default-category.svg",
    )

    thu_tu: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    dang_su_dung: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
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

    mon_an = relationship(
        "MonAn",
        back_populates="nhom_mon",
        passive_deletes=True,
    )