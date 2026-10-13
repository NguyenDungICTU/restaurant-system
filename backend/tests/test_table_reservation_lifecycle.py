from datetime import date, datetime, time, timedelta
import unittest
import uuid
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.ban import Ban
from app.models.dat_ban import DatBan
from app.models.khu_vuc import KhuVuc
from app.models.nhan_vien import NhanVien
from app.models.phien_ban import PhienBan
from app.models.thong_bao import ThongBao
from app.services.table_reservation_lifecycle import reconcile_reserved_table

TZ = ZoneInfo("Asia/Ho_Chi_Minh")
TABLES = [KhuVuc.__table__, NhanVien.__table__, Ban.__table__, DatBan.__table__, PhienBan.__table__, ThongBao.__table__]


class ReservedTableLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine, tables=TABLES)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, expire_on_commit=False)
        self.db = self.Session()
        self.area = KhuVuc(ten_khu_vuc="Test")
        self.staff = NhanVien(ten_dang_nhap="lifecycle-test", so_dien_thoai="0900000001", mat_khau="x", ho_ten="Test", vai_tro="QUAN_LY")
        self.db.add_all([self.area, self.staff])
        self.db.commit()
        self.table = Ban(ma_ban="T1", khu_vuc_id=self.area.id, suc_chua_toi_thieu=1, suc_chua_toi_da=4, loai_ban="THUONG", da_cau_hinh=True, trang_thai="DA_DAT", qr_token=uuid.uuid4().hex)
        self.db.add(self.table)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine, tables=TABLES)
        self.engine.dispose()

    def booking(self, start, status="DA_XAC_NHAN", arrived=None):
        row = DatBan(ma_dat_ban=("B" + uuid.uuid4().hex[:5]).upper(), ho_ten_khach="Test guest", so_dien_thoai="0911111111", so_luong_khach=2, ngay_dat=start.date(), gio_bat_dau=start.time().replace(tzinfo=None), thoi_luong_giu_ban=90, trang_thai=status, ban_id=self.table.id, khach_toi_at=arrived)
        self.db.add(row)
        self.db.commit()
        return row

    def test_reserved_table_enters_cleanup_after_90_minutes(self):
        now = datetime(2026, 10, 11, 19, 30, tzinfo=TZ)
        self.booking(now - timedelta(minutes=90))
        self.assertTrue(reconcile_reserved_table(self.db, self.table, now))
        self.assertEqual(self.table.trang_thai, "DANG_DON")

    def test_reserved_table_releases_after_90_plus_15_minutes(self):
        now = datetime(2026, 10, 11, 19, 45, tzinfo=TZ)
        self.booking(now - timedelta(minutes=105))
        self.assertTrue(reconcile_reserved_table(self.db, self.table, now))
        self.assertEqual(self.table.trang_thai, "TRONG")

    def test_future_booking_stays_reserved(self):
        now = datetime(2026, 10, 11, 18, 0, tzinfo=TZ)
        self.booking(now + timedelta(minutes=60))
        self.assertFalse(reconcile_reserved_table(self.db, self.table, now))
        self.assertEqual(self.table.trang_thai, "DA_DAT")

    def test_manually_cleaning_table_is_not_auto_released_or_reserved(self):
        now = datetime(2026, 10, 11, 18, 0, tzinfo=TZ)
        self.table.trang_thai = "DANG_DON"
        self.table.trang_thai_changed_at = now - timedelta(minutes=20)
        self.db.commit()
        self.booking(now + timedelta(hours=1))
        self.assertFalse(reconcile_reserved_table(self.db, self.table, now))
        self.assertEqual(self.table.trang_thai, "DANG_DON")

    def test_active_service_session_is_never_auto_released(self):
        now = datetime(2026, 10, 11, 19, 45, tzinfo=TZ)
        self.booking(now - timedelta(minutes=105), arrived=now - timedelta(minutes=100))
        session = PhienBan(ban_id=self.table.id, trang_thai="DANG_PHUC_VU", bat_dau_at=now - timedelta(minutes=100), created_by=self.staff.id)
        self.db.add(session)
        self.db.commit()
        self.assertFalse(reconcile_reserved_table(self.db, self.table, now))
        self.assertEqual(self.table.trang_thai, "DA_DAT")


if __name__ == "__main__":
    unittest.main()
