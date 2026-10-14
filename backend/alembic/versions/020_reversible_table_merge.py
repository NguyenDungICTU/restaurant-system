"""Keep original session id on order batches to support reversible table merge."""
from alembic import op
import sqlalchemy as sa

revision = "020_reversible_table_merge"
down_revision = "019_booking_timeout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dot_goi_mon", sa.Column("phien_ban_goc_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_dot_goi_mon_phien_ban_goc", "dot_goi_mon", "phien_ban",
        ["phien_ban_goc_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_dot_goi_mon_phien_ban_goc_id", "dot_goi_mon", ["phien_ban_goc_id"])


def downgrade() -> None:
    op.drop_index("ix_dot_goi_mon_phien_ban_goc_id", table_name="dot_goi_mon")
    op.drop_constraint("fk_dot_goi_mon_phien_ban_goc", "dot_goi_mon", type_="foreignkey")
    op.drop_column("dot_goi_mon", "phien_ban_goc_id")
