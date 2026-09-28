"""extend dishes with selling unit, description and preparation time"""
from alembic import op
import sqlalchemy as sa

revision = "010_extend_mon_an"
down_revision = "009_add_lich_hoat_dong"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("mon_an", sa.Column("don_vi_tinh", sa.String(30), nullable=False, server_default="phần"))
    op.add_column("mon_an", sa.Column("mo_ta_ngan", sa.String(500), nullable=True))
    op.add_column("mon_an", sa.Column("thoi_gian_che_bien_phut", sa.Integer(), nullable=False, server_default="15"))


def downgrade():
    op.drop_column("mon_an", "thoi_gian_che_bien_phut")
    op.drop_column("mon_an", "mo_ta_ngan")
    op.drop_column("mon_an", "don_vi_tinh")
