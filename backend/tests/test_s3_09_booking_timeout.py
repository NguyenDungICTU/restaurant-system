import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.models import Ban, DatBan, KhuVuc, NhanVien, NhatKyThaoTac, PhienBan, ThongBao
from app.routers.dat_ban import gia_han_dat_ban, danh_dau_khong_toi, router
from app.routers.ban import list_tables, build_table_details
from app.schemas.dat_ban import DatBanHomNayResponse
from app.services.today_bookings import booking_to_staff_view
from app.services.booking_timeout import timeout_view, no_show_warning, table_timeout_views

TZ = ZoneInfo("Asia/Ho_Chi_Minh")
NOW = datetime(2026, 10, 7, 18, 15, tzinfo=TZ)

class TimeoutTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine, tables=[m.__table__ for m in
            [KhuVuc, NhanVien, Ban, DatBan, PhienBan, ThongBao, NhatKyThaoTac]])
        self.db = Session(self.engine, expire_on_commit=False)
        area = KhuVuc(ten_khu_vuc="Tầng 1")
        user = NhanVien(ten_dang_nhap="test", so_dien_thoai="0900000001", mat_khau="unused", ho_ten="Test", vai_tro="PHUC_VU")
        self.db.add_all([area, user]); self.db.flush()
        self.user = user
        self.table = Ban(ma_ban="KV1-001", khu_vuc_id=area.id, suc_chua_toi_thieu=1,
                         suc_chua_toi_da=4, loai_ban="THUONG", trang_thai="DA_DAT", qr_token="test")
        self.db.add(self.table); self.db.flush()
        self.booking = self.make_booking("ABC123")
        self.db.commit()
        self.clock = patch("app.routers.dat_ban.datetime")
        self.mock_clock = self.clock.start(); self.mock_clock.now.return_value = NOW

    def tearDown(self):
        self.clock.stop(); self.db.close(); self.engine.dispose()

    def make_booking(self, code, **kwargs):
        values = dict(ma_dat_ban=code, ho_ten_khach="Test", so_dien_thoai="0900000000",
                      so_luong_khach=2, ngay_dat=NOW.date(), gio_bat_dau=NOW.replace(hour=18, minute=0).time().replace(tzinfo=None),
                      thoi_luong_giu_ban=90, trang_thai="DA_XAC_NHAN", ban_id=self.table.id)
        values.update(kwargs)
        booking = DatBan(**values); self.db.add(booking); return booking

    def test_15_minute_boundary_and_timezone(self):
        self.assertFalse(timeout_view(self.booking, NOW-timedelta(microseconds=1))["qua_gio_hen"])
        self.assertTrue(timeout_view(self.booking, NOW)["qua_gio_hen"])
        self.assertTrue(timeout_view(self.booking, NOW.astimezone(ZoneInfo("UTC")))["qua_gio_hen"])

    def test_extension_once_and_new_deadline(self):
        result = gia_han_dat_ban(self.booking.id, self.user, self.db)
        self.assertEqual(result["han_giu_ban_at"], NOW+timedelta(minutes=15))
        self.assertFalse(result["qua_gio_hen"])
        self.mock_clock.now.return_value = NOW+timedelta(minutes=15)
        with self.assertRaises(HTTPException) as ctx:
            gia_han_dat_ban(self.booking.id, self.user, self.db)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(len(self.db.scalars(select(NhatKyThaoTac)).all()), 1)

    def test_no_show_frees_table_keeps_history_and_audit(self):
        result = danh_dau_khong_toi(self.booking.id, self.user, self.db)
        self.assertEqual(result["trang_thai_ban"], "TRONG")
        self.assertEqual(result["so_lan_khong_toi_90_ngay"], 1)
        self.assertEqual(self.booking.ban_id, self.table.id)
        self.assertIsNotNone(self.booking.khong_toi_at)
        with self.assertRaises(HTTPException):
            danh_dau_khong_toi(self.booking.id, self.user, self.db)
        self.assertEqual(len(self.db.scalars(select(NhatKyThaoTac)).all()), 1)

    def test_arrived_or_pending_or_early_rejected(self):
        for status, arrived, when in [("CHO_XAC_NHAN", None, NOW), ("DA_XAC_NHAN", NOW, NOW),
                                     ("DA_XAC_NHAN", None, NOW-timedelta(seconds=1))]:
            self.booking.trang_thai=status; self.booking.khach_toi_at=arrived; self.db.commit()
            self.mock_clock.now.return_value=when
            for action in [gia_han_dat_ban, danh_dau_khong_toi]:
                with self.assertRaises(HTTPException) as ctx: action(self.booking.id, self.user, self.db)
                self.assertEqual(ctx.exception.status_code, 409)
            self.assertEqual(self.table.trang_thai, "DA_DAT")

    def test_extension_blocks_no_show_until_new_deadline(self):
        gia_han_dat_ban(self.booking.id, self.user, self.db)
        self.mock_clock.now.return_value=NOW+timedelta(minutes=14, seconds=59)
        with self.assertRaises(HTTPException): danh_dau_khong_toi(self.booking.id, self.user, self.db)
        self.mock_clock.now.return_value=NOW+timedelta(minutes=15)
        self.assertEqual(danh_dau_khong_toi(self.booking.id, self.user, self.db)["trang_thai_ban"], "TRONG")

    def test_active_service_session_not_freed(self):
        self.db.add(PhienBan(ban_id=self.table.id, trang_thai="DANG_PHUC_VU")); self.db.commit()
        with self.assertRaises(HTTPException): danh_dau_khong_toi(self.booking.id, self.user, self.db)
        self.assertEqual(self.booking.trang_thai, "DA_XAC_NHAN")
        self.assertEqual(self.table.trang_thai, "DA_DAT")

    def test_other_table_states_preserved(self):
        self.table.trang_thai="DANG_SU_DUNG"; self.db.commit()
        danh_dau_khong_toi(self.booking.id, self.user, self.db)
        self.assertEqual(self.table.trang_thai, "DANG_SU_DUNG")

    def test_history_window_and_phone_isolation(self):
        for n, age in enumerate([0, 89, 90, 91]):
            self.make_booking(f"OLD00{n}", trang_thai="KHACH_KHONG_TOI", khong_toi_at=NOW-timedelta(days=age))
        self.make_booking("OTHER1", trang_thai="KHACH_KHONG_TOI", khong_toi_at=NOW, so_dien_thoai="0900000002")
        self.db.commit()
        result=no_show_warning(self.db, "0900000000", NOW)
        self.assertEqual(result["so_lan_khong_toi_90_ngay"], 3)
        self.assertTrue(result["canh_bao_khong_toi"])

    def test_map_and_today_fields_not_stripped(self):
        fields=table_timeout_views(self.db, [self.table.id], NOW)[self.table.id]
        self.assertTrue(fields["qua_gio_hen"])
        view=DatBanHomNayResponse.model_validate(booking_to_staff_view(self.booking, NOW))
        self.assertTrue(view.qua_gio_hen)
        with patch("app.routers.ban.datetime") as clock:
            clock.now.return_value=NOW
            self.assertTrue(list_tables(None, self.db)[0].qua_gio_hen)
        self.booking.khach_toi_at=NOW; self.db.commit()
        self.assertFalse(table_timeout_views(self.db, [self.table.id], NOW)[self.table.id]["qua_gio_hen"])

    def test_http_roles_and_missing_booking(self):
        app=FastAPI(); app.include_router(router)
        app.dependency_overrides[get_db]=lambda: self.db
        app.dependency_overrides[get_current_user]=lambda: SimpleNamespace(id=self.user.id, vai_tro="BEP")
        client=TestClient(app)
        self.assertEqual(client.post(f"/api/dat-ban/{self.booking.id}/khong-toi").status_code,403)
        self.assertEqual(client.get("/api/dat-ban/lich-su-khong-toi?so_dien_thoai=0900000000").status_code,403)
        app.dependency_overrides[get_current_user]=lambda: self.user
        self.assertEqual(client.post("/api/dat-ban/9999/gia-han").status_code,404)
        self.assertEqual(client.get("/api/dat-ban/lich-su-khong-toi?so_dien_thoai=bad").status_code,422)
        self.assertEqual(client.post(f"/api/dat-ban/{self.booking.id}/khong-toi").status_code,200)

    def test_warning_returned_on_staff_and_public_creation(self):
        from app.routers.dat_ban import tao_yeu_cau_dat_ban, tao_dat_ban_cong_khai
        from app.schemas.dat_ban import DatBanCreate, DatBanResponse, PublicBookingCreate
        for n in range(3):
            self.make_booking(f"HIS00{n}", trang_thai="KHACH_KHONG_TOI", khong_toi_at=NOW-timedelta(days=n))
        self.db.commit()
        values=dict(ho_ten_khach="Test", so_dien_thoai="0900000000", so_luong_khach=2,
                    ngay_dat=NOW.date(), gio_bat_dau=NOW.replace(hour=20).time().replace(tzinfo=None))
        with patch("app.routers.dat_ban._validate_booking_window", return_value=(None,90)), \
             patch("app.routers.dat_ban._suitable_table_exists", return_value=True), \
             patch("app.routers.dat_ban.queue_booking_notification"):
            result=tao_yeu_cau_dat_ban(DatBanCreate(**values), self.user, self.db)
            self.assertTrue(DatBanResponse.model_validate(result).canh_bao_khong_toi)
            result=tao_dat_ban_cong_khai(PublicBookingCreate(**values,email="test@example.com"),self.db)
            self.assertTrue(result.canh_bao_khong_toi)
            self.assertEqual(result.so_lan_khong_toi_90_ngay,3)

    def test_unauthenticated_mutations_rejected(self):
        app=FastAPI(); app.include_router(router)
        app.dependency_overrides[get_db]=lambda: self.db
        client=TestClient(app)
        for suffix in ["gia-han", "khong-toi"]:
            self.assertEqual(client.post(f"/api/dat-ban/{self.booking.id}/{suffix}").status_code,401)

class TimeoutMigrationTests(unittest.TestCase):
    def test_migration_upgrade_and_downgrade_preserve_bookings(self):
        import importlib.util
        from pathlib import Path
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        from sqlalchemy import inspect, text
        spec=importlib.util.spec_from_file_location("timeout_migration",Path(__file__).parents[1]/"alembic/versions/019_booking_timeout.py")
        migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
        engine=create_engine("sqlite://")
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE dat_ban (id INTEGER PRIMARY KEY, so_dien_thoai VARCHAR(10), khong_toi_at DATETIME)"))
            connection.execute(text("INSERT INTO dat_ban (id,so_dien_thoai) VALUES (1,'0900000000')"))
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                self.assertIn("gia_han_giu_ban_at", {c["name"] for c in inspect(connection).get_columns("dat_ban")})
                self.assertEqual(len(inspect(connection).get_indexes("dat_ban")),1)
                migration.downgrade()
            self.assertEqual(connection.scalar(text("SELECT count(*) FROM dat_ban")),1)
            self.assertNotIn("gia_han_giu_ban_at", {c["name"] for c in inspect(connection).get_columns("dat_ban")})
        engine.dispose()

if __name__ == "__main__": unittest.main()
