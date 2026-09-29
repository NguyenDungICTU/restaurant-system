"""S4: invoices and payment records."""
from alembic import op
import sqlalchemy as sa

revision = "016_billing"
down_revision = "015_ordering_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ca_lam_viec",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nhan_vien_id", sa.Integer(), nullable=False),
        sa.Column("bat_dau_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ket_thuc_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trang_thai", sa.String(20), nullable=False, server_default="DANG_MO"),
        sa.Column("so_hoa_don", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("doanh_thu", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("tien_mat", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("chuyen_khoan", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("tong_giam_gia", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("so_ban", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tien_mat_thuc_te", sa.Numeric(14, 2), nullable=True),
        sa.Column("chenh_lech", sa.Numeric(14, 2), nullable=True),
        sa.Column("giai_trinh", sa.Text(), nullable=True),
        sa.Column("chot_boi_id", sa.Integer(), nullable=True),
        sa.Column("chot_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["nhan_vien_id"], ["nhan_vien.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["chot_boi_id"], ["nhan_vien.id"], ondelete="SET NULL"),
        sa.CheckConstraint("trang_thai IN ('DANG_MO', 'DA_CHOT', 'MO_LAI')", name="ck_ca_lam_viec_trang_thai"),
        sa.CheckConstraint("so_hoa_don >= 0 AND so_ban >= 0", name="ck_ca_lam_viec_counters"),
    )
    op.create_index("ix_ca_lam_viec_nhan_vien_bat_dau", "ca_lam_viec", ["nhan_vien_id", "bat_dau_at"])

    op.create_table(
        "hoa_don",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("so_hoa_don", sa.String(30), nullable=False),
        sa.Column("phien_ban_id", sa.Integer(), nullable=False),
        sa.Column("ca_lam_viec_id", sa.Integer(), nullable=True),
        sa.Column("tong_tien_hang", sa.Numeric(14, 2), nullable=False),
        sa.Column("giam_gia_phan_tram", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("giam_gia_so_tien", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("ly_do_giam_gia", sa.String(255), nullable=True),
        sa.Column("tong_thanh_toan", sa.Numeric(14, 2), nullable=False),
        sa.Column("phuong_thuc", sa.String(20), nullable=False),
        sa.Column("tien_khach_dua", sa.Numeric(14, 2), nullable=True),
        sa.Column("tien_thoi", sa.Numeric(14, 2), nullable=True),
        sa.Column("ma_tham_chieu", sa.String(100), nullable=True),
        sa.Column("trang_thai", sa.String(20), nullable=False, server_default="DA_CHOT"),
        sa.Column("nguoi_chot_id", sa.Integer(), nullable=False),
        sa.Column("chot_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("huy_boi_id", sa.Integer(), nullable=True),
        sa.Column("huy_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ly_do_huy", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["phien_ban_id"], ["phien_ban.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["ca_lam_viec_id"], ["ca_lam_viec.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["nguoi_chot_id"], ["nhan_vien.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["huy_boi_id"], ["nhan_vien.id"], ondelete="SET NULL"),
        sa.CheckConstraint("tong_tien_hang >= 0", name="ck_hoa_don_tong_tien_hang"),
        sa.CheckConstraint("giam_gia_phan_tram >= 0 AND giam_gia_phan_tram <= 50", name="ck_hoa_don_giam_gia_phan_tram"),
        sa.CheckConstraint("giam_gia_so_tien >= 0", name="ck_hoa_don_giam_gia_so_tien"),
        sa.CheckConstraint("tong_thanh_toan >= 0", name="ck_hoa_don_tong_thanh_toan"),
        sa.CheckConstraint("phuong_thuc IN ('TIEN_MAT', 'CHUYEN_KHOAN')", name="ck_hoa_don_phuong_thuc"),
        sa.CheckConstraint("trang_thai IN ('DA_CHOT', 'DA_HUY')", name="ck_hoa_don_trang_thai"),
    )
    op.create_unique_constraint("uq_hoa_don_so_hoa_don", "hoa_don", ["so_hoa_don"])
    op.create_index("ix_hoa_don_phien_ban_id", "hoa_don", ["phien_ban_id"])
    op.create_index("ix_hoa_don_chot_at", "hoa_don", ["chot_at"])


def downgrade() -> None:
    op.drop_index("ix_hoa_don_chot_at", table_name="hoa_don")
    op.drop_index("ix_hoa_don_phien_ban_id", table_name="hoa_don")
    op.drop_constraint("uq_hoa_don_so_hoa_don", "hoa_don", type_="unique")
    op.drop_table("hoa_don")
    op.drop_index("ix_ca_lam_viec_nhan_vien_bat_dau", table_name="ca_lam_viec")
    op.drop_table("ca_lam_viec")
