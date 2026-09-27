"""add temporary password state"""
from alembic import op
import sqlalchemy as sa

revision = "007_add_temp_password_state"
down_revision = "006_add_ban"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("nhan_vien", sa.Column("su_dung_mat_khau_tam", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("nhan_vien", "su_dung_mat_khau_tam")
