"""S2/S4: persist booking email notification attempts and final status."""
from alembic import op
import sqlalchemy as sa

revision = "013_booking_notifications"
down_revision = "012_booking_extensions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "thong_bao",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("dat_ban_id", sa.Integer(), nullable=False),
        sa.Column("loai", sa.String(30), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("trang_thai", sa.String(20), nullable=False, server_default="CHO_GUI"),
        sa.Column("so_lan_thu", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lan_thu_cuoi_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lan_tiep_theo_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("da_gui_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("loi_cuoi", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["dat_ban_id"], ["dat_ban.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "loai IN ('XAC_NHAN_DAT_BAN', 'HUY_DAT_BAN', 'NHAC_DAT_BAN')",
            name="ck_thong_bao_loai",
        ),
        sa.CheckConstraint(
            "trang_thai IN ('CHO_GUI', 'DANG_GUI', 'DA_GUI', 'THAT_BAI')",
            name="ck_thong_bao_trang_thai",
        ),
        sa.CheckConstraint("so_lan_thu >= 0 AND so_lan_thu <= 3", name="ck_thong_bao_so_lan_thu"),
    )
    op.create_index("ix_thong_bao_dat_ban_id", "thong_bao", ["dat_ban_id"])
    op.create_index("ix_thong_bao_trang_thai_lan_tiep_theo", "thong_bao", ["trang_thai", "lan_tiep_theo_at"])
    op.create_unique_constraint("uq_thong_bao_dat_ban_loai", "thong_bao", ["dat_ban_id", "loai"])


def downgrade() -> None:
    op.drop_constraint("uq_thong_bao_dat_ban_loai", "thong_bao", type_="unique")
    op.drop_index("ix_thong_bao_trang_thai_lan_tiep_theo", table_name="thong_bao")
    op.drop_index("ix_thong_bao_dat_ban_id", table_name="thong_bao")
    op.drop_table("thong_bao")
