"""add orders with immutable menu price snapshots

Revision ID: 009_order_price_snapshots
Revises: 008_hours_reservations
"""

from alembic import op
import sqlalchemy as sa


revision = "009_order_price_snapshots"
down_revision = "008_hours_reservations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "don_hang",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ban_an_id", sa.Integer(), sa.ForeignKey("ban_an.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("nhan_vien_id", sa.Integer(), sa.ForeignKey("nhan_vien.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="DANG_MO"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_don_hang_ban_an_id", "don_hang", ["ban_an_id"])
    op.create_table(
        "chi_tiet_don_hang",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("don_hang_id", sa.Integer(), sa.ForeignKey("don_hang.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mon_an_id", sa.Integer(), sa.ForeignKey("mon_an.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("ten_mon_tai_thoi_diem_goi", sa.String(length=150), nullable=False),
        sa.Column("gia_tai_thoi_diem_goi", sa.Integer(), nullable=False),
        sa.Column("so_luong", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("gia_tai_thoi_diem_goi > 0", name="ck_chi_tiet_gia_snapshot"),
        sa.CheckConstraint("so_luong BETWEEN 1 AND 100", name="ck_chi_tiet_so_luong"),
    )
    op.create_index("ix_chi_tiet_don_hang_don_hang_id", "chi_tiet_don_hang", ["don_hang_id"])


def downgrade() -> None:
    op.drop_index("ix_chi_tiet_don_hang_don_hang_id", table_name="chi_tiet_don_hang")
    op.drop_table("chi_tiet_don_hang")
    op.drop_index("ix_don_hang_ban_an_id", table_name="don_hang")
    op.drop_table("don_hang")
