from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base

class HoaDon(Base):
    __tablename__ = "hoa_don"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    so_hoa_don: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    phien_ban_id: Mapped[int] = mapped_column(ForeignKey("phien_ban.id", ondelete="RESTRICT"), nullable=False, index=True)
    ca_lam_viec_id: Mapped[int | None] = mapped_column(ForeignKey("ca_lam_viec.id", ondelete="SET NULL"))
    tong_tien_hang: Mapped[Decimal] = mapped_column(Numeric(14,2), nullable=False)
    giam_gia_phan_tram: Mapped[Decimal] = mapped_column(Numeric(5,2), nullable=False, default=0)
    giam_gia_so_tien: Mapped[Decimal] = mapped_column(Numeric(14,2), nullable=False, default=0)
    ly_do_giam_gia: Mapped[str | None] = mapped_column(String(255))
    tong_thanh_toan: Mapped[Decimal] = mapped_column(Numeric(14,2), nullable=False)
    phuong_thuc: Mapped[str] = mapped_column(String(20), nullable=False)
    tien_khach_dua: Mapped[Decimal | None] = mapped_column(Numeric(14,2))
    tien_thoi: Mapped[Decimal | None] = mapped_column(Numeric(14,2))
    ma_tham_chieu: Mapped[str | None] = mapped_column(String(100))
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="DA_CHOT")
    nguoi_chot_id: Mapped[int] = mapped_column(ForeignKey("nhan_vien.id", ondelete="RESTRICT"), nullable=False)
    chot_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    huy_boi_id: Mapped[int | None] = mapped_column(ForeignKey("nhan_vien.id", ondelete="SET NULL"))
    huy_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ly_do_huy: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
