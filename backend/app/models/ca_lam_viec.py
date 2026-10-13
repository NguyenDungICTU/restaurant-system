from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base

class CaLamViec(Base):
    __tablename__ = "ca_lam_viec"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nhan_vien_id: Mapped[int] = mapped_column(ForeignKey("nhan_vien.id", ondelete="RESTRICT"), nullable=False)
    bat_dau_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ket_thuc_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="DANG_MO")
    so_hoa_don: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    doanh_thu: Mapped[Decimal] = mapped_column(Numeric(14,2), nullable=False, default=0)
    tien_mat: Mapped[Decimal] = mapped_column(Numeric(14,2), nullable=False, default=0)
    chuyen_khoan: Mapped[Decimal] = mapped_column(Numeric(14,2), nullable=False, default=0)
    tong_giam_gia: Mapped[Decimal] = mapped_column(Numeric(14,2), nullable=False, default=0)
    so_ban: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tien_mat_thuc_te: Mapped[Decimal | None] = mapped_column(Numeric(14,2))
    chenh_lech: Mapped[Decimal | None] = mapped_column(Numeric(14,2))
    giai_trinh: Mapped[str | None] = mapped_column(Text)
    chot_boi_id: Mapped[int | None] = mapped_column(ForeignKey("nhan_vien.id", ondelete="SET NULL"))
    chot_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
