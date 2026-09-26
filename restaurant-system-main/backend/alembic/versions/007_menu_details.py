"""add menu price and preparation details

Revision ID: 007_menu_details
Revises: 006_tables_qr
"""

from alembic import op
import sqlalchemy as sa


revision = "007_menu_details"
down_revision = "006_tables_qr"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mon_an", sa.Column("gia_ban", sa.Integer(), nullable=True))
    op.add_column("mon_an", sa.Column("don_vi_tinh", sa.String(length=30), nullable=True))
    op.add_column("mon_an", sa.Column("mo_ta", sa.Text(), nullable=True))
    op.add_column(
        "mon_an",
        sa.Column("thoi_gian_che_bien_phut", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_mon_an_gia_ban",
        "mon_an",
        "gia_ban IS NULL OR (gia_ban > 0 AND gia_ban <= 50000000)",
    )
    op.create_check_constraint(
        "ck_mon_an_thoi_gian_che_bien",
        "mon_an",
        "thoi_gian_che_bien_phut IS NULL OR thoi_gian_che_bien_phut > 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_mon_an_thoi_gian_che_bien", "mon_an", type_="check")
    op.drop_constraint("ck_mon_an_gia_ban", "mon_an", type_="check")
    op.drop_column("mon_an", "thoi_gian_che_bien_phut")
    op.drop_column("mon_an", "mo_ta")
    op.drop_column("mon_an", "don_vi_tinh")
    op.drop_column("mon_an", "gia_ban")
