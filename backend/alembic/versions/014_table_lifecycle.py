"""S2/S4: add cleaning lifecycle to restaurant tables."""
from alembic import op
import sqlalchemy as sa

revision = "014_table_lifecycle"
down_revision = "013_booking_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_ban_trang_thai", "ban", type_="check")
    op.create_check_constraint(
        "ck_ban_trang_thai",
        "ban",
        "trang_thai IN ('TRONG', 'DANG_SU_DUNG', 'DA_DAT', 'DANG_DON', 'NGUNG_SU_DUNG')",
    )
    op.add_column(
        "ban",
        sa.Column("trang_thai_changed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE ban SET trang_thai_changed_at = updated_at WHERE trang_thai_changed_at IS NULL")


def downgrade() -> None:
    op.execute("UPDATE ban SET trang_thai = 'TRONG' WHERE trang_thai = 'DANG_DON'")
    op.drop_column("ban", "trang_thai_changed_at")
    op.drop_constraint("ck_ban_trang_thai", "ban", type_="check")
    op.create_check_constraint(
        "ck_ban_trang_thai",
        "ban",
        "trang_thai IN ('TRONG', 'DANG_SU_DUNG', 'DA_DAT', 'NGUNG_SU_DUNG')",
    )
