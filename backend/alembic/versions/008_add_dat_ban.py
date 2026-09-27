"""add booking requests and table assignment"""
from alembic import op
import sqlalchemy as sa

revision = "008_add_dat_ban"
down_revision = "007_add_temp_password_state"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "dat_ban",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ho_ten_khach", sa.String(100), nullable=False),
        sa.Column("so_dien_thoai", sa.String(10), nullable=False),
        sa.Column("so_luong_khach", sa.Integer(), nullable=False),
        sa.Column("ngay_dat", sa.Date(), nullable=False),
        sa.Column("gio_bat_dau", sa.Time(), nullable=False),
        sa.Column("thoi_luong_giu_ban", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("trang_thai", sa.String(30), nullable=False, server_default="CHO_XAC_NHAN"),
        sa.Column("ban_id", sa.Integer(), sa.ForeignKey("ban.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("so_luong_khach >= 1 AND so_luong_khach <= 30", name="ck_dat_ban_so_luong"),
    )
    op.create_index("ix_dat_ban_ban_ngay_trang_thai", "dat_ban", ["ban_id", "ngay_dat", "trang_thai"])


def downgrade():
    op.drop_index("ix_dat_ban_ban_ngay_trang_thai", table_name="dat_ban")
    op.drop_table("dat_ban")
