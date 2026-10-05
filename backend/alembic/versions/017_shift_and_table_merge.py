"""S4: table-session merging metadata."""
from alembic import op
import sqlalchemy as sa

revision = "017_shift_and_table_merge"
down_revision = "016_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("phien_ban", sa.Column("phien_chinh_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_phien_ban_phien_chinh",
        "phien_ban",
        "phien_ban",
        ["phien_chinh_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_phien_ban_phien_chinh_id", "phien_ban", ["phien_chinh_id"])


def downgrade() -> None:
    op.drop_index("ix_phien_ban_phien_chinh_id", table_name="phien_ban")
    op.drop_constraint("fk_phien_ban_phien_chinh", "phien_ban", type_="foreignkey")
    op.drop_column("phien_ban", "phien_chinh_id")
