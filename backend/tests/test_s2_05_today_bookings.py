import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.services.today_bookings import (
    build_today_booking_list,
    is_upcoming_30_minutes,
    mask_phone,
)


TZ = ZoneInfo("Asia/Ho_Chi_Minh")


class TodayBookingsTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 9, 29, 14, 0, tzinfo=TZ)

    def booking(
        self,
        *,
        booking_id=1,
        minute_offset=60,
        day_offset=0,
        status="CHO_XAC_NHAN",
        phone="0912345678",
        table=None,
    ):
        appointment = self.now + timedelta(
            days=day_offset,
            minutes=minute_offset,
        )
        return SimpleNamespace(
            id=booking_id,
            ho_ten_khach=f"Khách {booking_id}",
            so_dien_thoai=phone,
            so_luong_khach=4,
            ngay_dat=appointment.date(),
            gio_bat_dau=appointment.time().replace(
                second=0,
                microsecond=0,
                tzinfo=None,
            ),
            thoi_luong_giu_ban=90,
            trang_thai=status,
            ten_ban=table,
        )

    def test_only_today_and_ascending_time(self):
        rows = [
            self.booking(booking_id=1, minute_offset=180),
            self.booking(booking_id=2, minute_offset=60),
            self.booking(booking_id=3, day_offset=-1),
            self.booking(booking_id=4, day_offset=1),
            self.booking(booking_id=5, minute_offset=120),
        ]
        result = build_today_booking_list(rows, self.now)
        self.assertEqual(
            [row["ma_dat_ban"] for row in result],
            ["DB-000002", "DB-000005", "DB-000001"],
        )

    def test_required_fields_masked_phone_and_unassigned_table(self):
        row = build_today_booking_list(
            [
                self.booking(
                    booking_id=7,
                    minute_offset=60,
                    phone="0912345678",
                    table=None,
                )
            ],
            self.now,
        )[0]

        self.assertEqual(row["ma_dat_ban"], "DB-000007")
        self.assertEqual(row["so_dien_thoai_da_che"], "091****678")
        self.assertNotIn("0912345678", row.values())
        self.assertEqual(row["so_luong_khach"], 4)
        self.assertEqual(row["khung_gio"], "15:00 - 16:30")
        self.assertIsNone(row["ten_ban"])
        self.assertEqual(row["trang_thai"], "CHO_XAC_NHAN")

    def test_each_status_filter_and_all(self):
        statuses = [
            "CHO_XAC_NHAN",
            "DA_XAC_NHAN",
            "DA_HUY",
            "KHACH_KHONG_TOI",
        ]
        rows = [
            self.booking(
                booking_id=index + 1,
                minute_offset=60 + index * 10,
                status=status,
            )
            for index, status in enumerate(statuses)
        ]

        for status in statuses:
            with self.subTest(status=status):
                result = build_today_booking_list(
                    rows,
                    self.now,
                    status,
                )
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0]["trang_thai"], status)

        self.assertEqual(
            len(build_today_booking_list(rows, self.now)),
            4,
        )

    def test_upcoming_30_minute_boundaries(self):
        self.assertTrue(is_upcoming_30_minutes(self.booking(minute_offset=0), self.now))
        self.assertTrue(is_upcoming_30_minutes(self.booking(minute_offset=29), self.now))
        self.assertTrue(is_upcoming_30_minutes(self.booking(minute_offset=30), self.now))
        self.assertFalse(is_upcoming_30_minutes(self.booking(minute_offset=31), self.now))
        self.assertFalse(is_upcoming_30_minutes(self.booking(minute_offset=-1), self.now))

    def test_upcoming_group_first_and_sorted(self):
        rows = [
            self.booking(booking_id=1, minute_offset=90),
            self.booking(booking_id=2, minute_offset=30),
            self.booking(booking_id=3, minute_offset=-20),
            self.booking(booking_id=4, minute_offset=10),
        ]
        result = build_today_booking_list(rows, self.now)
        self.assertEqual(
            [row["ma_dat_ban"] for row in result],
            ["DB-000004", "DB-000002", "DB-000003", "DB-000001"],
        )

    def test_empty_list(self):
        self.assertEqual(build_today_booking_list([], self.now), [])

    def test_mask_exactly_four_middle_digits(self):
        self.assertEqual(mask_phone("0987654321"), "098****321")


if __name__ == "__main__":
    unittest.main()
