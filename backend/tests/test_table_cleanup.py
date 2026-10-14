from datetime import datetime, timedelta
import unittest
import uuid
from zoneinfo import ZoneInfo

from fastapi import HTTPException
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
from app.services.table_cleanup import finish_table_cleanup

TZ = ZoneInfo("Asia/Ho_Chi_Minh")
TABLES = [KhuVuc.__table__, NhanVien.__table__, Ban.__table__, DatBan.__table__, PhienBan.__table__, ThongBao.__table__]


class TableCleanupTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine, tables=TABLES)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        area = KhuVuc(ten_khu_vuc="Cleanup test")
        self.db.add(area)
        self.db.commit()
        self.table = Ban(
            ma_ban="CLEAN-1", khu_vuc_id=area.id, suc_chua_toi_thieu=1,
            suc_chua_toi_da=4, loai_ban="THUONG", da_cau_hinh=True,
            trang_thai="DANG_DON", qr_token=uuid.uuid4().hex,
        )
        self.db.add(self.table)
        self.db.commit()
        self.now = datetime(2026, 10, 13, 12, 0, tzinfo=TZ)

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine, tables=TABLES)
        self.engine.dispose()

    def add_booking(self, minutes):
        start = self.now + timedelta(minutes=minutes)
        row = DatBan(
            ma_dat_ban=("B" + uuid.uuid4().hex[:8]).upper(),
            ho_ten_khach="Khách tiếp theo", so_dien_thoai="0911111111",
            so_luong_khach=2, ngay_dat=start.date(),
            gio_bat_dau=start.time().replace(tzinfo=None),
            thoi_luong_giu_ban=90, trang_thai="DA_XAC_NHAN",
            ban_id=self.table.id,
        )
        self.db.add(row)
        self.db.commit()

    def test_no_booking_releases_table(self):
        result = finish_table_cleanup(self.db, self.table.id, self.now)
        self.assertEqual(result.trang_thai, "TRONG")

    def test_booking_within_30_minutes_reserves_table(self):
        self.add_booking(25)
        result = finish_table_cleanup(self.db, self.table.id, self.now)
        self.assertEqual(result.trang_thai, "DA_DAT")

    def test_booking_after_30_minutes_does_not_block_table(self):
        self.add_booking(31)
        result = finish_table_cleanup(self.db, self.table.id, self.now)
        self.assertEqual(result.trang_thai, "TRONG")

    def test_rejects_table_not_cleaning(self):
        self.table.trang_thai = "TRONG"
        self.db.commit()
        with self.assertRaises(HTTPException) as ctx:
            finish_table_cleanup(self.db, self.table.id, self.now)
        self.assertEqual(ctx.exception.status_code, 409)
