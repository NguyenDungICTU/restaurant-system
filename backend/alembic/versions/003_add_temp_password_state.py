"""add temporary password state

Revision ID: 003_add_temp_password_state
Revises: 002_add_khu_vuc
Create Date: 2026-09-24
"""

from alembic import op
import sqlalchemy as sa


revision = "003_add_temp_password_state"
down_revision = "002_add_khu_vuc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nhan_vien",
        sa.Column(
            "su_dung_mat_khau_tam",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "nhan_vien",
        "su_dung_mat_khau_tam",
    )
