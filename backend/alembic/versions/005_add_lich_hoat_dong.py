
"""add restaurant opening hours and booking settings

Revision ID: 005_add_lich_hoat_dong
Revises: 004_add_dat_ban
"""

from alembic import op
import sqlalchemy as sa


revision = "005_add_lich_hoat_dong"
down_revision = "004_add_dat_ban"
branch_labels = None
depends_on = None


def upgrade() -> None:

    # 1. Lịch hoạt động theo tuần
    op.create_table(
        "lich_hoat_dong",

        sa.Column(
            "thu",
            sa.Integer(),
            primary_key=True,
        ),

        sa.Column(
            "la_ngay_nghi",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.Column(
            "gio_mo_cua",
            sa.Time(),
            nullable=True,
        ),

        sa.Column(
            "gio_dong_cua",
            sa.Time(),
            nullable=True,
        ),
    )

    # 2. Ngày nghỉ đặc biệt
    op.create_table(
        "ngay_nghi_dac_biet",

        sa.Column(
            "ngay",
            sa.Date(),
            primary_key=True,
        ),

        sa.Column(
            "ten_ngay_nghi",
            sa.String(150),
            nullable=False,
        ),
    )

    # 3. Cấu hình thời lượng giữ bàn
    op.create_table(
        "cau_hinh_dat_ban",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),

        sa.Column(
            "thoi_luong_giu_ban",
            sa.Integer(),
            nullable=False,
            server_default="90",
        ),
    )


def downgrade() -> None:

    op.drop_table("cau_hinh_dat_ban")

    op.drop_table("ngay_nghi_dac_biet")

    op.drop_table("lich_hoat_dong")
