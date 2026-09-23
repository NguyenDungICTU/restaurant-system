"""create authentication tables

Revision ID: 001_create_auth_tables
Revises:
"""

from alembic import op
import sqlalchemy as sa


revision = "001_create_auth_tables"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:

    op.create_table(
        "nhan_vien",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),

        sa.Column(
            "ten_dang_nhap",
            sa.String(50),
            nullable=False,
        ),

        sa.Column(
            "so_dien_thoai",
            sa.String(20),
            nullable=False,
        ),

        sa.Column(
            "mat_khau",
            sa.String(255),
            nullable=False,
        ),

        sa.Column(
            "ho_ten",
            sa.String(100),
            nullable=False,
        ),

        sa.Column(
            "vai_tro",
            sa.String(30),
            nullable=False,
            server_default="PHUC_VU",
        ),

        sa.Column(
            "trang_thai",
            sa.String(30),
            nullable=False,
            server_default="HOAT_DONG",
        ),

        sa.Column(
            "so_lan_dang_nhap_sai",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),

        sa.Column(
            "cua_so_bat_dau_sai",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column(
            "khoa_den",
            sa.DateTime(timezone=True),
            nullable=True,
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
        "ix_nhan_vien_ten_dang_nhap",
        "nhan_vien",
        ["ten_dang_nhap"],
        unique=True,
    )

    op.create_index(
        "ix_nhan_vien_so_dien_thoai",
        "nhan_vien",
        ["so_dien_thoai"],
        unique=True,
    )

    op.create_table(
        "phien_dang_nhap",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),

        sa.Column(
            "nhan_vien_id",
            sa.Integer(),
            sa.ForeignKey(
                "nhan_vien.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "token_hash",
            sa.String(64),
            nullable=False,
        ),

        sa.Column(
            "ip_address",
            sa.String(45),
            nullable=True,
        ),

        sa.Column(
            "user_agent",
            sa.String(500),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.Column(
            "last_activity_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),

        sa.Column(
            "revoked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_phien_dang_nhap_nhan_vien_id",
        "phien_dang_nhap",
        ["nhan_vien_id"],
    )

    op.create_index(
        "ix_phien_dang_nhap_token_hash",
        "phien_dang_nhap",
        ["token_hash"],
        unique=True,
    )

    op.create_table(
        "nhat_ky_thao_tac",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),

        sa.Column(
            "nhan_vien_id",
            sa.Integer(),
            sa.ForeignKey("nhan_vien.id"),
            nullable=False,
        ),

        sa.Column(
            "hanh_dong",
            sa.String(50),
            nullable=False,
        ),

        sa.Column(
            "doi_tuong",
            sa.String(100),
            nullable=False,
        ),

        sa.Column(
            "doi_tuong_id",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "du_lieu_cu",
            sa.JSON(),
            nullable=True,
        ),

        sa.Column(
            "du_lieu_moi",
            sa.JSON(),
            nullable=True,
        ),

        sa.Column(
            "ip_address",
            sa.String(45),
            nullable=True,
        ),

        sa.Column(
            "user_agent",
            sa.String(500),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_nhat_ky_thao_tac_nhan_vien_id",
        "nhat_ky_thao_tac",
        ["nhan_vien_id"],
    )

    op.create_index(
        "ix_nhat_ky_thao_tac_created_at",
        "nhat_ky_thao_tac",
        ["created_at"],
    )


def downgrade() -> None:

    op.drop_index(
        "ix_nhat_ky_thao_tac_created_at",
        table_name="nhat_ky_thao_tac",
    )

    op.drop_index(
        "ix_nhat_ky_thao_tac_nhan_vien_id",
        table_name="nhat_ky_thao_tac",
    )

    op.drop_table("nhat_ky_thao_tac")

    op.drop_index(
        "ix_phien_dang_nhap_token_hash",
        table_name="phien_dang_nhap",
    )

    op.drop_index(
        "ix_phien_dang_nhap_nhan_vien_id",
        table_name="phien_dang_nhap",
    )

    op.drop_table("phien_dang_nhap")

    op.drop_index(
        "ix_nhan_vien_so_dien_thoai",
        table_name="nhan_vien",
    )

    op.drop_index(
        "ix_nhan_vien_ten_dang_nhap",
        table_name="nhan_vien",
    )

    op.drop_table("nhan_vien")