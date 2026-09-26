"""add table management and unpredictable QR tokens

Revision ID: 006_tables_qr
Revises: 005_auth_password_audit
"""

from alembic import op
import sqlalchemy as sa


revision = "006_tables_qr"
down_revision = "005_auth_password_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ban_an",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ma_ban", sa.String(length=50), nullable=False),
        sa.Column(
            "khu_vuc_id",
            sa.Integer(),
            sa.ForeignKey("khu_vuc.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("suc_chua_toi_thieu", sa.Integer(), nullable=False),
        sa.Column("suc_chua_toi_da", sa.Integer(), nullable=False),
        sa.Column("loai_ban", sa.String(length=20), nullable=False),
        sa.Column(
            "trang_thai",
            sa.String(length=30),
            nullable=False,
            server_default="TRONG",
        ),
        sa.Column("qr_token", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "suc_chua_toi_thieu >= 1 AND suc_chua_toi_da >= suc_chua_toi_thieu",
            name="ck_ban_an_suc_chua",
        ),
    )
    op.create_index("ix_ban_an_khu_vuc_id", "ban_an", ["khu_vuc_id"])
    op.execute(
        "CREATE UNIQUE INDEX ux_ban_an_ma_ban_chuan_hoa "
        "ON ban_an (lower(btrim(ma_ban)))"
    )
    op.create_index("ux_ban_an_qr_token", "ban_an", ["qr_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ux_ban_an_qr_token", table_name="ban_an")
    op.execute("DROP INDEX IF EXISTS ux_ban_an_ma_ban_chuan_hoa")
    op.drop_index("ix_ban_an_khu_vuc_id", table_name="ban_an")
    op.drop_table("ban_an")
