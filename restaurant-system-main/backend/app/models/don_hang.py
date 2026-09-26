from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class DonHang(Base):
    __tablename__ = "don_hang"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ban_an_id: Mapped[int] = mapped_column(
        ForeignKey("ban_an.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    nhan_vien_id: Mapped[int] = mapped_column(
        ForeignKey("nhan_vien.id", ondelete="RESTRICT"),
        nullable=False,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(30), nullable=False, default="DANG_MO", server_default="DANG_MO"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    chi_tiet: Mapped[list["ChiTietDonHang"]] = relationship(
        back_populates="don_hang",
        cascade="all, delete-orphan",
        order_by="ChiTietDonHang.id",
    )


class ChiTietDonHang(Base):
    __tablename__ = "chi_tiet_don_hang"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    don_hang_id: Mapped[int] = mapped_column(
        ForeignKey("don_hang.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mon_an_id: Mapped[int] = mapped_column(
        ForeignKey("mon_an.id", ondelete="RESTRICT"),
        nullable=False,
    )
    ten_mon_tai_thoi_diem_goi: Mapped[str] = mapped_column(String(150), nullable=False)
    gia_tai_thoi_diem_goi: Mapped[int] = mapped_column(Integer, nullable=False)
    so_luong: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    don_hang: Mapped[DonHang] = relationship(back_populates="chi_tiet")
