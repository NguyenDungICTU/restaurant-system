"""Allow newly created tables to remain unconfigured until their details are set."""
from alembic import op
import sqlalchemy as sa


revision = "018_unconfigured_tables"
down_revision = "017_shift_and_table_merge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ban",
        sa.Column(
            "da_cau_hinh",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.alter_column(
        "ban",
        "suc_chua_toi_thieu",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.alter_column(
        "ban",
        "suc_chua_toi_da",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.alter_column(
        "ban",
        "loai_ban",
        existing_type=sa.String(length=20),
        nullable=True,
    )
    op.drop_constraint("ck_ban_suc_chua", "ban", type_="check")
    op.create_check_constraint(
        "ck_ban_suc_chua",
        "ban",
        "(da_cau_hinh AND suc_chua_toi_thieu IS NOT NULL "
        "AND suc_chua_toi_da IS NOT NULL AND suc_chua_toi_thieu >= 1 "
        "AND suc_chua_toi_da >= suc_chua_toi_thieu) "
        "OR (NOT da_cau_hinh AND suc_chua_toi_thieu IS NULL "
        "AND suc_chua_toi_da IS NULL)",
    )
    op.drop_constraint("ck_ban_loai", "ban", type_="check")
    op.create_check_constraint(
        "ck_ban_loai",
        "ban",
        "(da_cau_hinh AND loai_ban IS NOT NULL "
        "AND loai_ban IN ('THUONG', 'PHONG_RIENG')) "
        "OR (NOT da_cau_hinh AND loai_ban IS NULL)",
    )


def downgrade() -> None:
    unconfigured_count = op.get_bind().scalar(
        sa.text("SELECT count(*) FROM ban WHERE da_cau_hinh = false")
    )
    if unconfigured_count:
        raise RuntimeError(
            "Cannot downgrade while unconfigured tables exist; configure them first."
        )

    op.drop_constraint("ck_ban_suc_chua", "ban", type_="check")
    op.drop_constraint("ck_ban_loai", "ban", type_="check")
    op.alter_column(
        "ban",
        "suc_chua_toi_thieu",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "ban",
        "suc_chua_toi_da",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "ban",
        "loai_ban",
        existing_type=sa.String(length=20),
        nullable=False,
    )
    op.drop_column("ban", "da_cau_hinh")
    op.create_check_constraint(
        "ck_ban_suc_chua",
        "ban",
        "suc_chua_toi_thieu >= 1 AND suc_chua_toi_da >= suc_chua_toi_thieu",
    )
    op.create_check_constraint(
        "ck_ban_loai",
        "ban",
        "loai_ban IN ('THUONG', 'PHONG_RIENG')",
    )
