"""S1-07: tables and persistent QR token history."""
from alembic import op
import sqlalchemy as sa

revision = "003_add_ban"
down_revision = "002_add_khu_vuc"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ban",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ma_ban", sa.String(50), nullable=False, unique=True),
        sa.Column("khu_vuc_id", sa.Integer(), sa.ForeignKey("khu_vuc.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("suc_chua_toi_thieu", sa.Integer(), nullable=False),
        sa.Column("suc_chua_toi_da", sa.Integer(), nullable=False),
        sa.Column("loai_ban", sa.String(20), nullable=False),
        sa.Column("trang_thai", sa.String(30), nullable=False, server_default="TRONG"),
        sa.Column("qr_token", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("suc_chua_toi_thieu >= 1 AND suc_chua_toi_da >= suc_chua_toi_thieu", name="ck_ban_suc_chua"),
        sa.CheckConstraint("loai_ban IN ('THUONG', 'PHONG_RIENG')", name="ck_ban_loai"),
        sa.CheckConstraint("trang_thai IN ('TRONG', 'DANG_SU_DUNG', 'DA_DAT', 'NGUNG_SU_DUNG')", name="ck_ban_trang_thai"),
    )
    op.create_index("ix_ban_khu_vuc_id", "ban", ["khu_vuc_id"])
    op.create_table(
        "ban_qr_token",
        sa.Column("token", sa.String(64), primary_key=True),
        sa.Column("ban_id", sa.Integer(), sa.ForeignKey("ban.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ban_qr_token_ban_id", "ban_qr_token", ["ban_id"])


def downgrade():
    op.drop_table("ban_qr_token")
    op.drop_table("ban")
