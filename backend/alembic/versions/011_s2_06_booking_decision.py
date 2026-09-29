"""S2-06 booking decision fields."""

from alembic import op
import sqlalchemy as sa


revision = "011_s2_06_booking_decision"
down_revision = "010_extend_mon_an"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "dat_ban",
        sa.Column("khu_vuc_yeu_cau_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_dat_ban_khu_vuc_yeu_cau",
        "dat_ban",
        "khu_vuc",
        ["khu_vuc_yeu_cau_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "dat_ban",
        sa.Column("ly_do_tu_choi", sa.String(40), nullable=True),
    )
    op.add_column(
        "dat_ban",
        sa.Column("thong_bao_khach", sa.Text(), nullable=True),
    )
    op.add_column(
        "dat_ban",
        sa.Column(
            "thong_bao_gui_luc",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("dat_ban", "thong_bao_gui_luc")
    op.drop_column("dat_ban", "thong_bao_khach")
    op.drop_column("dat_ban", "ly_do_tu_choi")
    op.drop_constraint(
        "fk_dat_ban_khu_vuc_yeu_cau",
        "dat_ban",
        type_="foreignkey",
    )
    op.drop_column("dat_ban", "khu_vuc_yeu_cau_id")
