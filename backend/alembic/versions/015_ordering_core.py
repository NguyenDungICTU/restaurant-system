"""S3: table service sessions, order batches and kitchen order lines."""
from alembic import op
import sqlalchemy as sa

revision = "015_ordering_core"
down_revision = "014_table_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "phien_ban",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ban_id", sa.Integer(), nullable=False),
        sa.Column("trang_thai", sa.String(30), nullable=False, server_default="DANG_PHUC_VU"),
        sa.Column("bat_dau_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("cho_thanh_toan_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dong_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["ban_id"], ["ban.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["nhan_vien.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "trang_thai IN ('DANG_PHUC_VU', 'CHO_THANH_TOAN', 'DA_DONG', 'DA_GOP')",
            name="ck_phien_ban_trang_thai",
        ),
    )
    op.create_index("ix_phien_ban_ban_id_trang_thai", "phien_ban", ["ban_id", "trang_thai"])

    op.create_table(
        "dot_goi_mon",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("phien_ban_id", sa.Integer(), nullable=False),
        sa.Column("so_dot", sa.Integer(), nullable=False),
        sa.Column("gui_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["phien_ban_id"], ["phien_ban.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["nhan_vien.id"], ondelete="SET NULL"),
        sa.CheckConstraint("so_dot >= 1", name="ck_dot_goi_mon_so_dot"),
        sa.UniqueConstraint("phien_ban_id", "so_dot", name="uq_dot_goi_mon_phien_so_dot"),
    )
    op.create_index("ix_dot_goi_mon_phien_ban_id", "dot_goi_mon", ["phien_ban_id"])

    op.create_table(
        "dong_goi_mon",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("dot_goi_mon_id", sa.Integer(), nullable=False),
        sa.Column("mon_an_id", sa.Integer(), nullable=False),
        sa.Column("so_luong", sa.Integer(), nullable=False),
        sa.Column("don_gia", sa.Numeric(12, 2), nullable=False),
        sa.Column("ghi_chu", sa.String(200), nullable=True),
        sa.Column("trang_thai", sa.String(30), nullable=False, server_default="CHO_BEP"),
        sa.Column("thoi_diem_tiep_nhan", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("bat_dau_che_bien_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hoan_thanh_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("phuc_vu_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("huy_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ly_do_huy", sa.String(100), nullable=True),
        sa.Column("tinh_tien", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("ban_goc_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["dot_goi_mon_id"], ["dot_goi_mon.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mon_an_id"], ["mon_an.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["ban_goc_id"], ["ban.id"], ondelete="SET NULL"),
        sa.CheckConstraint("so_luong >= 1", name="ck_dong_goi_mon_so_luong"),
        sa.CheckConstraint("don_gia >= 0", name="ck_dong_goi_mon_don_gia"),
        sa.CheckConstraint(
            "trang_thai IN ('CHO_BEP', 'DANG_CHE_BIEN', 'DA_XONG', 'DA_PHUC_VU', 'DA_HUY')",
            name="ck_dong_goi_mon_trang_thai",
        ),
        sa.CheckConstraint(
            "ly_do_huy IS NULL OR char_length(ly_do_huy) <= 100",
            name="ck_dong_goi_mon_ly_do_huy",
        ),
    )
    op.create_index("ix_dong_goi_mon_dot_goi_mon_id", "dong_goi_mon", ["dot_goi_mon_id"])
    op.create_index("ix_dong_goi_mon_trang_thai_tiep_nhan", "dong_goi_mon", ["trang_thai", "thoi_diem_tiep_nhan"])


def downgrade() -> None:
    op.drop_index("ix_dong_goi_mon_trang_thai_tiep_nhan", table_name="dong_goi_mon")
    op.drop_index("ix_dong_goi_mon_dot_goi_mon_id", table_name="dong_goi_mon")
    op.drop_table("dong_goi_mon")
    op.drop_index("ix_dot_goi_mon_phien_ban_id", table_name="dot_goi_mon")
    op.drop_table("dot_goi_mon")
    op.drop_index("ix_phien_ban_ban_id_trang_thai", table_name="phien_ban")
    op.drop_table("phien_ban")
