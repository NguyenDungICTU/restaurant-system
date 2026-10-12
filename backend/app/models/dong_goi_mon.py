from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class DongGoiMon(Base):
    __tablename__ = "dong_goi_mon"
    __table_args__ = (
        CheckConstraint("so_luong >= 1", name="ck_dong_goi_mon_so_luong"),
        CheckConstraint("don_gia >= 0", name="ck_dong_goi_mon_don_gia"),
        CheckConstraint(
            "trang_thai IN ('CHO_BEP', 'DANG_CHE_BIEN', 'DA_XONG', 'DA_PHUC_VU', 'DA_HUY')",
            name="ck_dong_goi_mon_trang_thai",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dot_goi_mon_id: Mapped[int] = mapped_column(
        ForeignKey("dot_goi_mon.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mon_an_id: Mapped[int] = mapped_column(
        ForeignKey("mon_an.id", ondelete="RESTRICT"), nullable=False
    )
    so_luong: Mapped[int] = mapped_column(Integer, nullable=False)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(String(200), nullable=True)
    trang_thai: Mapped[str] = mapped_column(
        String(30), nullable=False, default="CHO_BEP", server_default="CHO_BEP"
    )
    thoi_diem_tiep_nhan: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    bat_dau_che_bien_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hoan_thanh_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    phuc_vu_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    huy_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ly_do_huy: Mapped[str | None] = mapped_column(String(100))
    tinh_tien: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    ban_goc_id: Mapped[int | None] = mapped_column(
        ForeignKey("ban.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
