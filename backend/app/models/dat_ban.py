from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.database.base import Base
from app.models.ban import Ban
from app.models.khu_vuc import KhuVuc


class DatBan(Base):
    __tablename__ = "dat_ban"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )

    ma_dat_ban: Mapped[str] = mapped_column(
        String(6), nullable=False, unique=True
    )

    ho_ten_khach: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    so_dien_thoai: Mapped[str] = mapped_column(
        String(10), nullable=False
    )

    so_luong_khach: Mapped[int] = mapped_column(
        Integer, nullable=False
    )

    ngay_dat: Mapped[date] = mapped_column(
        Date, nullable=False
    )

    gio_bat_dau: Mapped[time] = mapped_column(
        Time, nullable=False
    )

    thoi_luong_giu_ban: Mapped[int] = mapped_column(
        Integer, nullable=False, default=90
    )

    trang_thai: Mapped[str] = mapped_column(
        String(30), nullable=False, default="CHO_XAC_NHAN"
    )

    ban_id: Mapped[int | None] = mapped_column(
        ForeignKey("ban.id", ondelete="RESTRICT"),
        nullable=True,
    )
    ban: Mapped[Ban | None] = relationship()

    # The database has one physical column: dat_ban.khu_vuc_id.
    # The router still uses khu_vuc_yeu_cau_id for backward compatibility,
    # so expose it as a SQLAlchemy synonym instead of mapping the column twice.
    khu_vuc_id: Mapped[int | None] = mapped_column(
        ForeignKey("khu_vuc.id", ondelete="RESTRICT"),
        nullable=True,
    )
    khu_vuc_yeu_cau_id = synonym("khu_vuc_id")
    khu_vuc: Mapped[KhuVuc | None] = relationship()

    ly_do_tu_choi: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    xac_nhan_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    huy_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    khach_toi_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    khong_toi_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    ghi_chu: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(254),
        nullable=True,
    )

    thong_bao = relationship(
        "ThongBao",
        back_populates="dat_ban",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def _notification(self, loai: str):
        for item in self.thong_bao:
            if item.loai == loai:
                return item
        return None

    @property
    def email_xac_nhan_trang_thai(self) -> str | None:
        item = self._notification("XAC_NHAN_DAT_BAN")
        return item.trang_thai if item else None

    @property
    def email_xac_nhan_so_lan_thu(self) -> int:
        item = self._notification("XAC_NHAN_DAT_BAN")
        return item.so_lan_thu if item else 0

    @property
    def email_xac_nhan_gui_luc(self) -> datetime | None:
        item = self._notification("XAC_NHAN_DAT_BAN")
        return item.da_gui_at if item else None

    @property
    def email_xac_nhan_loi_cuoi(self) -> str | None:
        item = self._notification("XAC_NHAN_DAT_BAN")
        return item.loi_cuoi if item else None

    @property
    def email_huy_trang_thai(self) -> str | None:
        item = self._notification("HUY_DAT_BAN")
        return item.trang_thai if item else None

    @property
    def email_huy_so_lan_thu(self) -> int:
        item = self._notification("HUY_DAT_BAN")
        return item.so_lan_thu if item else 0

    @property
    def email_huy_gui_luc(self) -> datetime | None:
        item = self._notification("HUY_DAT_BAN")
        return item.da_gui_at if item else None

    @property
    def email_huy_loi_cuoi(self) -> str | None:
        item = self._notification("HUY_DAT_BAN")
        return item.loi_cuoi if item else None

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    @property
    def thong_bao_khach(self) -> str | None:
        value = getattr(self, "_thong_bao_khach", None)
        if value:
            return value

        if self.trang_thai == "DA_HUY" and self.ly_do_tu_choi:
            labels = {
                "HET_BAN": "Hết bàn",
                "NGOAI_GIO_PHUC_VU": "Ngoài giờ phục vụ",
                "KHONG_LIEN_LAC_DUOC": "Không liên lạc được",
            }
            reason = labels.get(self.ly_do_tu_choi, self.ly_do_tu_choi)
            return f"Đặt bàn DB-{self.id:06d} đã bị từ chối. Lý do: {reason}."

        if self.trang_thai == "DA_XAC_NHAN" and self.ten_ban:
            return f"Đặt bàn DB-{self.id:06d} đã được xác nhận. Bàn: {self.ten_ban}."

        return None

    @thong_bao_khach.setter
    def thong_bao_khach(self, value: str | None):
        self._thong_bao_khach = value

    @property
    def thong_bao_gui_luc(self) -> datetime | None:
        return self.huy_at if self.trang_thai == "DA_HUY" else self.xac_nhan_at

    @thong_bao_gui_luc.setter
    def thong_bao_gui_luc(self, value: datetime | None):
        if self.trang_thai == "DA_HUY":
            self.huy_at = value
        else:
            self.xac_nhan_at = value

    @property
    def ten_ban(self) -> str | None:
        return self.ban.ma_ban if self.ban else None
