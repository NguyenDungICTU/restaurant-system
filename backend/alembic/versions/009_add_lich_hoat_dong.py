"""add weekly opening hours and special holidays"""
from alembic import op
import sqlalchemy as sa

revision = "009_add_lich_hoat_dong"
down_revision = "008_add_dat_ban"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "lich_hoat_dong",
        sa.Column("thu", sa.Integer(), primary_key=True),
        sa.Column("la_ngay_nghi", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("gio_mo_cua", sa.Time(), nullable=True),
        sa.Column("gio_dong_cua", sa.Time(), nullable=True),
    )
    op.create_table(
        "ngay_nghi_dac_biet",
        sa.Column("ngay", sa.Date(), primary_key=True),
        sa.Column("ten_ngay_nghi", sa.String(150), nullable=False),
    )
    op.create_table(
        "cau_hinh_dat_ban",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("thoi_luong_giu_ban", sa.Integer(), nullable=False, server_default="90"),
    )
    op.bulk_insert(
        sa.table("lich_hoat_dong", sa.column("thu", sa.Integer()), sa.column("la_ngay_nghi", sa.Boolean()), sa.column("gio_mo_cua", sa.Time()), sa.column("gio_dong_cua", sa.Time())),
        [
            {"thu": i, "la_ngay_nghi": False, "gio_mo_cua": __import__('datetime').time(8, 0), "gio_dong_cua": __import__('datetime').time(22, 0)}
            for i in range(7)
        ],
    )
    op.bulk_insert(
        sa.table("cau_hinh_dat_ban", sa.column("id", sa.Integer()), sa.column("thoi_luong_giu_ban", sa.Integer())),
        [{"id": 1, "thoi_luong_giu_ban": 90}],
    )


def downgrade():
    op.drop_table("cau_hinh_dat_ban")
    op.drop_table("ngay_nghi_dac_biet")
    op.drop_table("lich_hoat_dong")
