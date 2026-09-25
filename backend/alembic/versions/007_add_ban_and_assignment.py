"""Add physical restaurant tables and booking assignments."""

from alembic import op
import sqlalchemy as sa

revision = "007_add_ban_and_assignment"
down_revision = "006_merge_booking_menu_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ban",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ten_ban", sa.String(50), nullable=False),
        sa.Column("so_cho", sa.Integer(), nullable=False),
        sa.Column(
            "khu_vuc_id",
            sa.Integer(),
            sa.ForeignKey("khu_vuc.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "hoat_dong",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "so_cho BETWEEN 1 AND 30",
            name="ck_ban_so_cho",
        ),
        sa.UniqueConstraint("ten_ban", name="uq_ban_ten_ban"),
    )

    op.add_column(
        "dat_ban",
        sa.Column("ban_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_dat_ban_ban_id",
        "dat_ban",
        "ban",
        ["ban_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_index(
        "ix_dat_ban_ban_ngay_trang_thai",
        "dat_ban",
        ["ban_id", "ngay_dat", "trang_thai"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_dat_ban_ban_ngay_trang_thai",
        table_name="dat_ban",
    )
    op.drop_constraint(
        "fk_dat_ban_ban_id",
        "dat_ban",
        type_="foreignkey",
    )
    op.drop_column("dat_ban", "ban_id")
    op.drop_table("ban")
