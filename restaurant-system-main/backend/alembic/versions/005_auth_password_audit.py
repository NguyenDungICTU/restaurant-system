"""require first-login password changes and expand audit records

Revision ID: 005_auth_password_audit
Revises: 004_add_khu_vuc
"""

from alembic import op
import sqlalchemy as sa


revision = "005_auth_password_audit"
down_revision = "004_add_khu_vuc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nhan_vien",
        sa.Column(
            "doi_mat_khau_lan_dau",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.alter_column(
        "nhat_ky_thao_tac",
        "nhan_vien_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.add_column(
        "nhat_ky_thao_tac",
        sa.Column("vai_tro", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "nhat_ky_thao_tac",
        sa.Column("tai_khoan", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("nhat_ky_thao_tac", "tai_khoan")
    op.drop_column("nhat_ky_thao_tac", "vai_tro")
    op.alter_column(
        "nhat_ky_thao_tac",
        "nhan_vien_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_column("nhan_vien", "doi_mat_khau_lan_dau")
