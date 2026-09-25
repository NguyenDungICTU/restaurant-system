"""merge booking and menu branches, initialize existing UI's opening hours

Revision ID: 006_merge_booking_menu_heads
Revises: 005_add_lich_hoat_dong, 003_add_menu_images
"""

from alembic import op

revision = "006_merge_booking_menu_heads"
down_revision = ("005_add_lich_hoat_dong", "003_add_menu_images")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Default hours from OpeningHoursSettings.jsx. Do not overwrite manager edits.
    op.execute("""
        INSERT INTO lich_hoat_dong (thu, la_ngay_nghi, gio_mo_cua, gio_dong_cua)
        VALUES
            (0, false, TIME '08:00', TIME '22:00'),
            (1, false, TIME '08:00', TIME '22:00'),
            (2, false, TIME '08:00', TIME '22:00'),
            (3, false, TIME '08:00', TIME '22:00'),
            (4, false, TIME '08:00', TIME '23:00'),
            (5, false, TIME '08:00', TIME '23:00'),
            (6, true, NULL, NULL)
        ON CONFLICT (thu) DO NOTHING
    """)
    op.execute("""
        INSERT INTO cau_hinh_dat_ban (id, thoi_luong_giu_ban)
        VALUES (1, 90)
        ON CONFLICT (id) DO NOTHING
    """)


def downgrade() -> None:
    # A merge does not drop any table. Retain operational settings on downgrade.
    pass
