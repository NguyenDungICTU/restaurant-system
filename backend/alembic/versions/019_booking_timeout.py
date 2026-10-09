"""S3-09: one booking hold extension and indexed no-show history."""
from alembic import op
import sqlalchemy as sa

revision = "019_booking_timeout"
down_revision = "018_unconfigured_tables"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("dat_ban", sa.Column("gia_han_giu_ban_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_dat_ban_phone_no_show", "dat_ban", ["so_dien_thoai", "khong_toi_at"])

def downgrade():
    op.drop_index("ix_dat_ban_phone_no_show", table_name="dat_ban")
    op.drop_column("dat_ban", "gia_han_giu_ban_at")
