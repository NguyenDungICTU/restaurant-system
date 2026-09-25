"""add dish price"""

from alembic import op
import sqlalchemy as sa

revision = "005_add_dish_price"
down_revision = "004_add_khu_vuc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "mon_an",
        sa.Column("gia", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("mon_an", "gia")
