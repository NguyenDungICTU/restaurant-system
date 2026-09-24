"""add menu image urls

Revision ID: 003_add_menu_images
Revises: 002_add_menu_categories
"""
from alembic import op
import sqlalchemy as sa

revision = "003_add_menu_images"
down_revision = "002_add_menu_categories"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("nhom_mon", sa.Column("anh_url", sa.String(500), nullable=True))
    op.add_column("mon_an", sa.Column("anh_url", sa.String(500), nullable=True))
    op.execute("UPDATE nhom_mon SET anh_url = '/media/default-category.svg' WHERE anh_url IS NULL")
    op.execute("UPDATE mon_an SET anh_url = '/media/default-dish.svg' WHERE anh_url IS NULL")
    op.alter_column("nhom_mon", "anh_url", nullable=False, server_default="/media/default-category.svg")
    op.alter_column("mon_an", "anh_url", nullable=False, server_default="/media/default-dish.svg")

def downgrade() -> None:
    op.drop_column("mon_an", "anh_url")
    op.drop_column("nhom_mon", "anh_url")
