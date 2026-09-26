"""add menu categories and menu items

Revision ID: 002_add_menu_categories
Revises: 001_create_auth_tables
"""

from alembic import op
import sqlalchemy as sa


revision = "002_add_menu_categories"
down_revision = "001_create_auth_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nhom_mon",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),

        sa.Column(
            "ten_nhom",
            sa.String(50),
            nullable=False,
        ),

        sa.Column(
            "thu_tu",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),

        sa.Column(
            "dang_su_dung",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # PostgreSQL:
    # "Khai vị" và " khai vị " được xem là cùng tên.
    # Không phân biệt hoa thường.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_nhom_mon_ten_normalized
        ON nhom_mon (LOWER(BTRIM(ten_nhom)))
        """
    )

    op.create_index(
        "ix_nhom_mon_thu_tu",
        "nhom_mon",
        ["thu_tu"],
    )

    op.create_table(
        "mon_an",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),

        sa.Column(
            "ten_mon",
            sa.String(150),
            nullable=False,
        ),

        sa.Column(
            "nhom_mon_id",
            sa.Integer(),
            sa.ForeignKey(
                "nhom_mon.id",
                ondelete="RESTRICT",
            ),
            nullable=False,
        ),

        sa.Column(
            "trang_thai",
            sa.String(30),
            nullable=False,
            server_default="DANG_BAN",
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_mon_an_nhom_mon_id",
        "mon_an",
        ["nhom_mon_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_mon_an_nhom_mon_id",
        table_name="mon_an",
    )

    op.drop_table("mon_an")

    op.drop_index(
        "ix_nhom_mon_thu_tu",
        table_name="nhom_mon",
    )

    op.execute(
        """
        DROP INDEX IF EXISTS uq_nhom_mon_ten_normalized
        """
    )

    op.drop_table("nhom_mon")