"""Store guest information for table sessions."""

from alembic import op
import sqlalchemy as sa

revision = "019_table_session_guests"
down_revision = "018_unconfigured_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "phien_ban",
        sa.Column("ho_ten_khach", sa.String(100), nullable=True),
    )
    op.add_column(
        "phien_ban",
        sa.Column("so_luong_khach", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("phien_ban", "so_luong_khach")
    op.drop_column("phien_ban", "ho_ten_khach")
