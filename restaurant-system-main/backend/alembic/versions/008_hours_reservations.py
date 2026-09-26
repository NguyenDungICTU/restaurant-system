"""add weekly business hours, special closure dates and reservations

Revision ID: 008_hours_reservations
Revises: 007_menu_details
"""

from alembic import op
import sqlalchemy as sa


revision = "008_hours_reservations"
down_revision = "007_menu_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gio_hoat_dong",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("thu_trong_tuan", sa.Integer(), nullable=False, unique=True),
        sa.Column("ngay_nghi", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("gio_mo_cua", sa.Time(), nullable=True),
        sa.Column("gio_dong_cua", sa.Time(), nullable=True),
        sa.CheckConstraint("thu_trong_tuan BETWEEN 0 AND 6", name="ck_gio_hoat_dong_thu"),
        sa.CheckConstraint(
            "ngay_nghi OR (gio_mo_cua IS NOT NULL AND gio_dong_cua > gio_mo_cua)",
            name="ck_gio_hoat_dong_khung_gio",
        ),
    )
    op.create_table(
        "cau_hinh_dat_ban",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("thoi_luong_phut", sa.Integer(), nullable=False, server_default="90"),
        sa.CheckConstraint("thoi_luong_phut BETWEEN 30 AND 720", name="ck_cau_hinh_dat_ban_duration"),
    )
    op.create_table(
        "ngay_nghi_dac_biet",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ngay", sa.Date(), nullable=False),
        sa.Column("ghi_chu", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("ngay", name="uq_ngay_nghi_dac_biet_ngay"),
    )
    op.create_table(
        "dat_ban",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ten_khach", sa.String(length=100), nullable=False),
        sa.Column("so_dien_thoai", sa.String(length=20), nullable=False),
        sa.Column("so_khach", sa.Integer(), nullable=False),
        sa.Column("bat_dau_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("thoi_luong_phut", sa.Integer(), nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="CHO_XAC_NHAN"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("so_khach BETWEEN 1 AND 100", name="ck_dat_ban_so_khach"),
    )
    op.create_index("ix_dat_ban_bat_dau_at", "dat_ban", ["bat_dau_at"])
    for weekday in range(7):
        op.execute(
            sa.text(
                "INSERT INTO gio_hoat_dong (thu_trong_tuan, ngay_nghi) "
                "VALUES (:weekday, true)"
            ).bindparams(weekday=weekday)
        )
    op.execute(
        "INSERT INTO cau_hinh_dat_ban (id, thoi_luong_phut) VALUES (1, 90)"
    )


def downgrade() -> None:
    op.drop_index("ix_dat_ban_bat_dau_at", table_name="dat_ban")
    op.drop_table("dat_ban")
    op.drop_table("ngay_nghi_dac_biet")
    op.drop_table("cau_hinh_dat_ban")
    op.drop_table("gio_hoat_dong")
