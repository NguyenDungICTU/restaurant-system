from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class MonAn(Base):
    __tablename__ = "mon_an"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    ten_mon: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    anh_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        default="/media/default-dish.svg",
        server_default="/media/default-dish.svg",
    )

    nhom_mon_id: Mapped[int] = mapped_column(
        ForeignKey(
            "nhom_mon.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    trang_thai: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="DANG_BAN",
        server_default="DANG_BAN",
    )

    gia_ban: Mapped[int | None] = mapped_column(Integer, nullable=True)

    don_vi_tinh: Mapped[str | None] = mapped_column(String(30), nullable=True)

    mo_ta: Mapped[str | None] = mapped_column(Text, nullable=True)

    thoi_gian_che_bien_phut: Mapped[int | None] = mapped_column(
        Integer,
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

    nhom_mon = relationship(
        "NhomMon",
        back_populates="mon_an",
    )