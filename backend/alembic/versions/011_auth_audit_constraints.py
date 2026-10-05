"""S1: tighten auth/audit data constraints."""
from alembic import op
import sqlalchemy as sa

revision = "011_auth_audit_constraints"
down_revision = "010_extend_mon_an"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nhat_ky_thao_tac",
        sa.Column("vai_tro", sa.String(30), nullable=True),
    )

    op.create_check_constraint(
        "ck_nhan_vien_vai_tro",
        "nhan_vien",
        "vai_tro IN ('QUAN_LY', 'PHUC_VU', 'BEP', 'THU_NGAN')",
    )
    op.create_check_constraint(
        "ck_nhan_vien_trang_thai",
        "nhan_vien",
        "trang_thai IN ('HOAT_DONG', 'DA_NGHI')",
    )
    op.create_check_constraint(
        "ck_mon_an_gia",
        "mon_an",
        "gia > 0 AND gia <= 50000000",
    )
    op.create_check_constraint(
        "ck_mon_an_trang_thai",
        "mon_an",
        "trang_thai IN ('DANG_BAN', 'TAM_HET', 'NGUNG_BAN')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_mon_an_trang_thai", "mon_an", type_="check")
    op.drop_constraint("ck_mon_an_gia", "mon_an", type_="check")
    op.drop_constraint("ck_nhan_vien_trang_thai", "nhan_vien", type_="check")
    op.drop_constraint("ck_nhan_vien_vai_tro", "nhan_vien", type_="check")
    op.drop_column("nhat_ky_thao_tac", "vai_tro")
