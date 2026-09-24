from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class KhuVuc(Base):
    __tablename__ = "khu_vuc"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    ten_khu_vuc: Mapped[str] = mapped_column(String(100), nullable=False)
    thu_tu_hien_thi: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)

    # HOAT_DONG hoặc NGUNG_SU_DUNG
    trang_thai: Mapped[str] = mapped_column(
        String(30), nullable=False, default="HOAT_DONG"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )