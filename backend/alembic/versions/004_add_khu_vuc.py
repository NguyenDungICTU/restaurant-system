"""add khu vuc

Revision ID: 003_add_khu_vuc
Revises: 002_add_menu_categories
Create Date: 2026-09-24
"""


from alembic import op
import sqlalchemy as sa


revision = "004_add_khu_vuc"
down_revision = "003_add_menu_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "khu_vuc",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ten_khu_vuc", sa.String(length=100), nullable=False),
        sa.Column(
            "thu_tu_hien_thi",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column(
            "trang_thai",
            sa.String(length=30),
            nullable=False,
            server_default="HOAT_DONG",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.execute(
        """
        CREATE UNIQUE INDEX ux_khu_vuc_ten_chuan_hoa
        ON khu_vuc (lower(btrim(ten_khu_vuc)))
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_khu_vuc_ten_chuan_hoa")
    op.drop_table("khu_vuc")