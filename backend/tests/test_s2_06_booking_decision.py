import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.services.booking_decision import (
    REJECTION_REASON_LABELS,
    can_move_booking,
    confirmation_message,
    overlaps,
    rejection_message,
)


TZ = ZoneInfo("Asia/Ho_Chi_Minh")


class BookingDecisionTests(unittest.TestCase):
    def test_overlap(self):
        self.assertTrue(overlaps(600, 690, 650, 720))
        self.assertFalse(overlaps(600, 690, 690, 780))

    def test_fixed_rejection_reasons(self):
        self.assertEqual(
            set(REJECTION_REASON_LABELS),
            {
                "HET_BAN",
                "NGOAI_GIO_PHUC_VU",
                "KHONG_LIEN_LAC_DUOC",
            },
        )

    def test_rejection_message(self):
        booking = SimpleNamespace(id=12)
        message = rejection_message(booking, "HET_BAN")
        self.assertIn("DB-000012", message)
        self.assertIn("Hết bàn", message)

    def test_confirmation_message(self):
        booking = SimpleNamespace(id=5)
        table = SimpleNamespace(ma_ban="B05")
        message = confirmation_message(booking, table)
        self.assertIn("DB-000005", message)
        self.assertIn("B05", message)

    def test_move_only_before_appointment(self):
        now = datetime(2026, 9, 29, 15, 0, tzinfo=TZ)
        future = now + timedelta(minutes=30)
        booking = SimpleNamespace(
            trang_thai="DA_XAC_NHAN",
            ngay_dat=future.date(),
            gio_bat_dau=future.time().replace(
                second=0,
                microsecond=0,
                tzinfo=None,
            ),
        )
        self.assertTrue(can_move_booking(booking, now))

        current = SimpleNamespace(
            trang_thai="DA_XAC_NHAN",
            ngay_dat=now.date(),
            gio_bat_dau=now.time().replace(
                second=0,
                microsecond=0,
                tzinfo=None,
            ),
        )
        self.assertFalse(can_move_booking(current, now))

    def test_pending_cannot_move(self):
        now = datetime(2026, 9, 29, 15, 0, tzinfo=TZ)
        future = now + timedelta(hours=1)
        booking = SimpleNamespace(
            trang_thai="CHO_XAC_NHAN",
            ngay_dat=future.date(),
            gio_bat_dau=future.time().replace(
                second=0,
                microsecond=0,
                tzinfo=None,
            ),
        )
        self.assertFalse(can_move_booking(booking, now))


if __name__ == "__main__":
    unittest.main()
