
"""add dat ban table

Revision ID: 004_add_dat_ban
Revises: 003_add_temp_password_state
"""

from alembic import op
import sqlalchemy as sa


revision = "004_add_dat_ban"
down_revision = "003_add_temp_password_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dat_ban",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),

        sa.Column(
            "ho_ten_khach",
            sa.String(100),
            nullable=False,
        ),

        sa.Column(
            "so_dien_thoai",
            sa.String(10),
            nullable=False,
        ),

        sa.Column(
            "so_luong_khach",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "ngay_dat",
            sa.Date(),
            nullable=False,
        ),

        sa.Column(
            "gio_bat_dau",
            sa.Time(),
            nullable=False,
        ),

        sa.Column(
            "thoi_luong_giu_ban",
            sa.Integer(),
            nullable=False,
            server_default="90",
        ),

        sa.Column(
            "trang_thai",
            sa.String(30),
            nullable=False,
            server_default="CHO_XAC_NHAN",
        ),

        sa.Column(
            "ghi_chu",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("dat_ban")
