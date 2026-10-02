"""Public booking (S2-02) contract tests using disposable PostgreSQL."""
import os
import re
import subprocess
import unittest
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.engine import make_url
import psycopg2
from psycopg2 import sql

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
MA_DAT_BAN_RE = re.compile(r"^[A-Z0-9]{6}$")


class PublicBookingIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_database_url = os.environ["DATABASE_URL"]
        source = make_url(os.environ["DATABASE_URL"])
        cls.database_name = "test_public_booking_" + uuid.uuid4().hex
        cls.admin = psycopg2.connect(source.set(drivername="postgresql").render_as_string(hide_password=False))
        cls.admin.autocommit = True
        with cls.admin.cursor() as cursor:
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(cls.database_name)))
        cls.addClassCleanup(cls.drop_database)
        os.environ["DATABASE_URL"] = source.set(database=cls.database_name).render_as_string(hide_password=False)
        subprocess.run(["alembic", "upgrade", "head"], check=True)

        from fastapi.testclient import TestClient
        from app.main import app
        from app.database.session import SessionLocal, engine
        from app.models.ban import Ban
        from app.models.khu_vuc import KhuVuc

        cls.app, cls.client, cls.sessions, cls.engine = app, TestClient(app), SessionLocal, engine

        with SessionLocal() as db:
            # Lịch tuần và cấu hình giữ bàn đã được migration 009 seed sẵn.
            area = KhuVuc(ten_khu_vuc="Sân vườn", trang_thai="HOAT_DONG")
            db.add(area)
            db.flush()
            cls.area_id = area.id
            db.add(Ban(
                ma_ban="B01",
                khu_vuc_id=area.id,
                suc_chua_toi_thieu=2,
                suc_chua_toi_da=4,
                loai_ban="THUONG",
                trang_thai="TRONG",
                qr_token="tok-public-booking-01",
            ))
            db.commit()

        cls.open_date = datetime.now(VIETNAM_TZ).date() + timedelta(days=7)
        cls.holiday_date = cls.open_date + timedelta(days=7)
        cls._phone_counter = 0

    def setUp(self):
        type(self)._phone_counter += 1
        self.phone = f"09{type(self)._phone_counter:08d}"

    @classmethod
    def drop_database(cls):
        if hasattr(cls, "client"):
            cls.client.close()
        if hasattr(cls, "engine"):
            cls.engine.dispose()
        with cls.admin.cursor() as cursor:
            cursor.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(cls.database_name)))
        cls.admin.close()
        os.environ["DATABASE_URL"] = cls.original_database_url

    def payload(self, **changes):
        base = {
            "ho_ten_khach": "Nguyễn Văn A",
            "so_dien_thoai": self.phone,
            "so_luong_khach": 2,
            "ngay_dat": self.open_date.isoformat(),
            "gio_bat_dau": "12:00",
            "khu_vuc_id": self.area_id,
            "ghi_chu": None,
        }
        base.update(changes)
        return base

    def test_public_booking_rejects_invalid_phone(self):
        response = self.client.post("/api/dat-ban/cong-khai", json=self.payload(so_dien_thoai="0912345"))
        self.assertEqual(response.status_code, 422, response.text)

    def test_public_booking_rejects_invalid_guests(self):
        self.assertEqual(
            self.client.post("/api/dat-ban/cong-khai", json=self.payload(so_luong_khach=0)).status_code,
            422,
        )
        self.assertEqual(
            self.client.post("/api/dat-ban/cong-khai", json=self.payload(so_luong_khach=21)).status_code,
            422,
        )

    def test_public_time_slots_respect_opening_hours(self):
        response = self.client.get(
            "/api/dat-ban/cong-khai/khung-gio",
            params={"ngay": self.open_date.isoformat(), "so_luong_khach": 2},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertIsNone(payload["ly_do"])
        self.assertEqual(payload["gio_mo_cua"], "08:00")
        self.assertEqual(payload["gio_dong_cua"], "22:00")
        slots = payload["khung_gio"]
        # 08:00 -> 20:30, 90 phút giữ bàn, bước 30 phút.
        self.assertEqual(slots[0]["gio"], "08:00")
        self.assertEqual(slots[-1]["gio"], "20:30")
        self.assertTrue(all(slot["kha_dung"] for slot in slots))

    def test_public_time_slots_no_suitable_table(self):
        response = self.client.get(
            "/api/dat-ban/cong-khai/khung-gio",
            params={"ngay": self.open_date.isoformat(), "so_luong_khach": 6},
        )
        self.assertEqual(response.status_code, 200, response.text)
        slots = response.json()["khung_gio"]
        self.assertTrue(slots)
        self.assertTrue(all(not slot["kha_dung"] for slot in slots))
        self.assertTrue(all("hết bàn" in slot["ly_do"] for slot in slots))

    def test_public_time_slots_holiday(self):
        from app.models.lich_hoat_dong import NgayNghiDacBiet
        with self.sessions() as db:
            db.add(NgayNghiDacBiet(ngay=self.holiday_date, ten_ngay_nghi="Bảo trì"))
            db.commit()

        response = self.client.get(
            "/api/dat-ban/cong-khai/khung-gio",
            params={"ngay": self.holiday_date.isoformat(), "so_luong_khach": 2},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["khung_gio"], [])
        self.assertIn("nghỉ", payload["ly_do"])

    def test_public_booking_creates_six_char_code(self):
        response = self.client.post("/api/dat-ban/cong-khai", json=self.payload())
        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        self.assertTrue(MA_DAT_BAN_RE.match(payload["ma_dat_ban"]), payload["ma_dat_ban"])
        self.assertEqual(payload["trang_thai"], "CHO_XAC_NHAN")
        self.assertEqual(payload["ten_khu_vuc"], "Sân vườn")
        self.assertEqual(payload["so_dien_thoai"], self.phone)

    def test_public_booking_limits_three_pending(self):
        for _ in range(3):
            response = self.client.post("/api/dat-ban/cong-khai", json=self.payload())
            self.assertEqual(response.status_code, 201, response.text)

        response = self.client.post("/api/dat-ban/cong-khai", json=self.payload())
        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("3 lượt", response.json()["detail"])

    def test_public_booking_rejects_full_slot(self):
        response = self.client.post(
            "/api/dat-ban/cong-khai",
            json=self.payload(so_luong_khach=6),
        )
        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("hết bàn", response.json()["detail"])

    def test_public_booking_requires_no_auth(self):
        response = self.client.get("/api/dat-ban/cong-khai/khu-vuc")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), [{"id": self.area_id, "ten_khu_vuc": "Sân vườn"}])


if __name__ == "__main__":
    unittest.main()
