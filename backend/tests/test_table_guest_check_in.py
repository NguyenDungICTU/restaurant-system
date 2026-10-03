from datetime import date, datetime, time, timedelta
from types import SimpleNamespace
import unittest
import uuid
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.dependencies.roles import require_roles
from app.models.ban import Ban
from app.models.dat_ban import DatBan
from app.models.khu_vuc import KhuVuc
from app.models.lich_hoat_dong import LichHoatDong, NgayNghiDacBiet
from app.models.nhan_vien import NhanVien
from app.models.phien_ban import PhienBan
from app.routers.dat_ban import lay_ban_trong, xac_nhan_va_phan_ban
from app.routers.ban import (
    list_arrival_bookings,
    read_table,
    read_table_by_code,
    receive_table_guests,
    router as ban_router,
)
from app.schemas.dat_ban import (
    DatBanChoNhanKhachResponse,
    NhanKhachBanRequest,
    XacNhanDatBan,
)


VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
TEST_TABLES = [
    KhuVuc.__table__,
    NhanVien.__table__,
    Ban.__table__,
    DatBan.__table__,
    PhienBan.__table__,
    LichHoatDong.__table__,
    NgayNghiDacBiet.__table__,
]


class TableGuestCheckInTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine, tables=TEST_TABLES)
        with self.engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE dot_goi_mon (
                    id INTEGER PRIMARY KEY,
                    phien_ban_id INTEGER NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE dong_goi_mon (
                    id INTEGER PRIMARY KEY,
                    dot_goi_mon_id INTEGER NOT NULL,
                    so_luong INTEGER NOT NULL,
                    don_gia NUMERIC NOT NULL,
                    trang_thai VARCHAR(30) NOT NULL,
                    tinh_tien BOOLEAN NOT NULL
                )
                """
            )
        self.sessions = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
        )
        self.db = self.sessions()
        area = KhuVuc(ten_khu_vuc="Tầng 1")
        employee = NhanVien(
            ten_dang_nhap="checkin-test",
            so_dien_thoai="0900000000",
            mat_khau="not-used",
            ho_ten="Nhân viên kiểm thử",
            vai_tro="PHUC_VU",
        )
        self.db.add_all([area, employee])
        self.db.commit()
        self.area_id = area.id
        self.employee_id = employee.id
        self.user = SimpleNamespace(
            id=self.employee_id,
            vai_tro="PHUC_VU",
        )

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine, tables=TEST_TABLES)
        self.engine.dispose()

    def create_table(self, status="TRONG", configured=True):
        table = Ban(
            ma_ban=f"M{uuid.uuid4().hex[:8]}".upper(),
            khu_vuc_id=self.area_id,
            suc_chua_toi_thieu=1 if configured else None,
            suc_chua_toi_da=4 if configured else None,
            loai_ban="THUONG" if configured else None,
            da_cau_hinh=configured,
            trang_thai=status,
            qr_token=uuid.uuid4().hex,
        )
        self.db.add(table)
        self.db.commit()
        return table

    def create_booking(self, table_id, start_at):
        booking = DatBan(
            ho_ten_khach=f"Khách {start_at.strftime('%H%M')}",
            so_dien_thoai="0911111111",
            so_luong_khach=2,
            ngay_dat=start_at.date(),
            gio_bat_dau=start_at.time().replace(tzinfo=None),
            thoi_luong_giu_ban=90,
            trang_thai="DA_XAC_NHAN",
            ban_id=table_id,
        )
        self.db.add(booking)
        self.db.commit()
        return booking

    def test_empty_table_check_in_starts_a_service_session(self):
        table = self.create_table()

        response = receive_table_guests(
            table.id,
            NhanKhachBanRequest(),
            self.user,
            self.db,
        )

        self.assertEqual(response["trang_thai"], "DANG_SU_DUNG")
        self.db.expire_all()
        self.assertEqual(self.db.get(Ban, table.id).trang_thai, "DANG_SU_DUNG")
        service_session = self.db.scalar(
            select(PhienBan).where(PhienBan.ban_id == table.id)
        )
        self.assertIsNotNone(service_session)
        self.assertEqual(service_session.trang_thai, "DANG_PHUC_VU")
        self.assertIsNotNone(service_session.bat_dau_at)

    def test_table_detail_endpoint_includes_empty_service_fields(self):
        table = self.create_table()

        detail = read_table(table.id, self.db)
        from app.schemas.ban import BanDetailsResponse

        parsed = BanDetailsResponse.model_validate(detail)

        self.assertEqual(parsed.id, table.id)
        self.assertEqual(parsed.ma_ban, table.ma_ban.upper())
        self.assertEqual(parsed.khu_vuc_id, self.area_id)
        self.assertEqual(parsed.suc_chua_toi_thieu, 1)
        self.assertEqual(parsed.suc_chua_toi_da, 4)
        self.assertEqual(parsed.trang_thai, "TRONG")
        self.assertIsNone(parsed.khach_dang_ngoi)
        self.assertIsNone(parsed.bat_dau_phuc_vu_at)
        self.assertIsNone(parsed.tam_tinh_hien_tai)
        self.assertIsNone(parsed.dat_ban_sap_toi)

        detail_route = next(
            route
            for route in ban_router.routes
            if getattr(route, "path", None) == "/api/ban/{table_id}"
            and "GET" in route.methods
        )
        dependency = detail_route.dependant.dependencies[0].call
        for role in ("QUAN_LY", "PHUC_VU"):
            self.assertEqual(
                dependency(
                    current_user=SimpleNamespace(vai_tro=role)
                ).vai_tro,
                role,
            )

        with self.assertRaises(HTTPException) as forbidden:
            dependency(current_user=SimpleNamespace(vai_tro="BEP"))
        self.assertEqual(forbidden.exception.status_code, 403)

    def test_table_details_use_current_session_and_non_cancelled_orders(self):
        from app.schemas.ban import BanDetailsResponse

        now = datetime.now(VIETNAM_TZ)
        table = self.create_table(status="DANG_SU_DUNG")
        active_session = PhienBan(
            ban_id=table.id,
            trang_thai="DANG_PHUC_VU",
            bat_dau_at=now - timedelta(minutes=30),
        )
        old_session = PhienBan(
            ban_id=table.id,
            trang_thai="DA_DONG",
            bat_dau_at=now - timedelta(days=1),
        )
        self.db.add_all([active_session, old_session])
        self.db.commit()
        self.db.refresh(active_session)
        self.db.refresh(old_session)

        seated_booking = self.create_booking(
            table.id,
            now - timedelta(minutes=30),
        )
        seated_booking.khach_toi_at = now - timedelta(minutes=25)
        self.db.commit()

        upcoming_booking = self.create_booking(
            table.id,
            now + timedelta(hours=2),
        )
        old_booking = self.create_booking(
            table.id,
            now - timedelta(days=1),
        )
        cancelled_booking = self.create_booking(
            table.id,
            now + timedelta(hours=1),
        )
        cancelled_booking.trang_thai = "DA_HUY"
        self.db.commit()

        self.db.execute(
            text(
                """
                INSERT INTO dot_goi_mon (id, phien_ban_id)
                VALUES (1, :active_id), (2, :old_id)
                """
            ),
            {"active_id": active_session.id, "old_id": old_session.id},
        )
        self.db.execute(
            text(
                """
                INSERT INTO dong_goi_mon
                    (id, dot_goi_mon_id, so_luong, don_gia, trang_thai, tinh_tien)
                VALUES
                    (1, 1, 2, 12500, 'DA_PHUC_VU', true),
                    (2, 1, 5, 9000, 'DA_HUY', true),
                    (3, 1, 3, 5000, 'DA_PHUC_VU', false),
                    (4, 2, 1, 99999, 'DA_PHUC_VU', true)
                """
            )
        )
        self.db.commit()

        detail = BanDetailsResponse.model_validate(
            read_table(table.id, self.db)
        )

        self.assertEqual(
            detail.khach_dang_ngoi.ho_ten_khach,
            seated_booking.ho_ten_khach,
        )
        self.assertEqual(
            detail.khach_dang_ngoi.so_luong_khach,
            2,
        )
        self.assertEqual(
            detail.bat_dau_phuc_vu_at,
            active_session.bat_dau_at,
        )
        self.assertEqual(detail.tam_tinh_hien_tai, 25000)
        self.assertEqual(detail.dat_ban_sap_toi.id, upcoming_booking.id)
        self.assertNotEqual(detail.dat_ban_sap_toi.id, cancelled_booking.id)
        self.assertNotEqual(detail.dat_ban_sap_toi.id, old_booking.id)

    def test_non_serving_tables_do_not_expose_old_service_session(self):
        from app.schemas.ban import BanDetailsResponse

        for status in ("TRONG", "DANG_DON"):
            with self.subTest(status=status):
                table = self.create_table(status=status)
                old_session = PhienBan(
                    ban_id=table.id,
                    trang_thai="DANG_PHUC_VU",
                    bat_dau_at=(
                        datetime.now(VIETNAM_TZ)
                        - timedelta(minutes=20)
                    ),
                )
                self.db.add(old_session)
                self.db.commit()

                detail = BanDetailsResponse.model_validate(
                    read_table(table.id, self.db)
                )

                self.assertIsNone(detail.khach_dang_ngoi)
                self.assertIsNone(detail.bat_dau_phuc_vu_at)
                self.assertIsNone(detail.tam_tinh_hien_tai)

    def test_table_detail_returns_404_for_missing_table(self):
        with self.assertRaises(HTTPException) as missing:
            read_table(999999, self.db)
        self.assertEqual(missing.exception.status_code, 404)

    def test_table_detail_can_be_found_by_code(self):
        table = self.create_table()

        detail = read_table_by_code(table.ma_ban.lower(), self.db)

        self.assertEqual(detail["id"], table.id)
        self.assertEqual(detail["ma_ban"], table.ma_ban.upper())
        with self.assertRaises(HTTPException) as missing:
            read_table_by_code("MISSING-TABLE", self.db)
        self.assertEqual(missing.exception.status_code, 404)

    def test_table_detail_http_response_and_role_access(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.database.session import get_db
        from app.dependencies.auth import get_current_user

        table = self.create_table()
        api = FastAPI()
        api.include_router(ban_router)
        api.dependency_overrides[get_db] = lambda: self.db
        api.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
            vai_tro="PHUC_VU"
        )

        with TestClient(api) as client:
            response = client.get(f"/api/ban/{table.id}")
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIsNone(response.json()["tam_tinh_hien_tai"])
            code_response = client.get(
                f"/api/ban/ma/{table.ma_ban.lower()}"
            )
            self.assertEqual(code_response.status_code, 200)
            self.assertEqual(code_response.json()["id"], table.id)
            self.assertEqual(
                client.get("/api/ban/999999").status_code,
                404,
            )
            self.assertEqual(
                client.get("/api/ban/ma/MISSING-TABLE").status_code,
                404,
            )

            api.dependency_overrides[get_current_user] = (
                lambda: SimpleNamespace(vai_tro="BEP")
            )
            self.assertEqual(
                client.get(f"/api/ban/{table.id}").status_code,
                403,
            )
            self.assertEqual(
                client.get(
                    f"/api/ban/ma/{table.ma_ban}"
                ).status_code,
                403,
            )

    def test_active_session_without_orders_has_zero_subtotal(self):
        from app.schemas.ban import BanDetailsResponse

        table = self.create_table(status="DANG_SU_DUNG")
        self.db.add(
            PhienBan(
                ban_id=table.id,
                trang_thai="DANG_PHUC_VU",
                bat_dau_at=datetime.now(VIETNAM_TZ),
            )
        )
        self.db.commit()

        detail = BanDetailsResponse.model_validate(
            read_table(table.id, self.db)
        )

        self.assertEqual(detail.tam_tinh_hien_tai, 0)

    def test_reserved_table_requires_an_arrived_booking_and_marks_it_arrived(self):
        table = self.create_table(status="DA_DAT")
        now = datetime.now(VIETNAM_TZ)
        future = self.create_booking(table.id, now + timedelta(minutes=20))
        eligible = self.create_booking(table.id, now - timedelta(minutes=10))

        response = list_arrival_bookings(table.id, self.db)

        self.assertEqual([item.id for item in response], [eligible.id])
        self.assertEqual(
            DatBanChoNhanKhachResponse.model_validate(response[0]).id,
            eligible.id,
        )

        with self.assertRaises(HTTPException) as missing_booking:
            receive_table_guests(
                table.id,
                NhanKhachBanRequest(),
                self.user,
                self.db,
            )
        self.assertEqual(missing_booking.exception.status_code, 409)

        accepted = receive_table_guests(
            table.id,
            NhanKhachBanRequest(dat_ban_id=eligible.id),
            self.user,
            self.db,
        )

        self.assertEqual(accepted["dat_ban_id"], eligible.id)
        self.db.expire_all()
        self.assertIsNotNone(self.db.get(DatBan, eligible.id).khach_toi_at)
        self.assertIsNone(self.db.get(DatBan, future.id).khach_toi_at)
        self.assertEqual(self.db.get(Ban, table.id).trang_thai, "DANG_SU_DUNG")

    def test_multiple_arrived_bookings_require_explicit_booking_selection(self):
        table = self.create_table(status="DA_DAT")
        now = datetime.now(VIETNAM_TZ)
        first = self.create_booking(table.id, now - timedelta(minutes=20))
        second = self.create_booking(table.id, now - timedelta(minutes=10))

        candidates = list_arrival_bookings(table.id, self.db)
        self.assertEqual(
            {item.id for item in candidates},
            {first.id, second.id},
        )

        response = receive_table_guests(
            table.id,
            NhanKhachBanRequest(dat_ban_id=second.id),
            self.user,
            self.db,
        )
        self.assertEqual(response["dat_ban_id"], second.id)
        self.db.expire_all()
        self.assertIsNone(self.db.get(DatBan, first.id).khach_toi_at)
        self.assertIsNotNone(self.db.get(DatBan, second.id).khach_toi_at)

    def test_non_manager_or_server_role_is_forbidden(self):
        table = self.create_table()
        self.user.vai_tro = "BEP"

        route = next(
            route
            for route in ban_router.routes
            if getattr(route, "path", None)
            == "/api/ban/{table_id}/nhan-khach"
        )
        current_user_dependency = next(
            dependency.call
            for dependency in route.dependant.dependencies
            if dependency.name == "current_user"
        )
        for role in ("QUAN_LY", "PHUC_VU"):
            allowed_user = SimpleNamespace(
                id=self.employee_id,
                vai_tro=role,
            )
            self.assertIs(
                current_user_dependency(current_user=allowed_user),
                allowed_user,
            )

        with self.assertRaises(HTTPException) as response:
            current_user_dependency(current_user=self.user)

        self.assertEqual(response.exception.status_code, 403)
        self.db.expire_all()
        self.assertEqual(self.db.get(Ban, table.id).trang_thai, "TRONG")

    def test_changed_or_unsupported_table_status_returns_conflict(self):
        for status in ("DANG_DON", "DANG_SU_DUNG", "NGUNG_SU_DUNG"):
            with self.subTest(status=status):
                table = self.create_table(status=status)

                with self.assertRaises(HTTPException) as response:
                    receive_table_guests(
                        table.id,
                        NhanKhachBanRequest(),
                        self.user,
                        self.db,
                    )

                self.assertEqual(response.exception.status_code, 409)
                self.db.expire_all()
                self.assertEqual(
                    self.db.get(Ban, table.id).trang_thai,
                    status,
                )

    def test_unconfigured_table_cannot_be_received_or_start_a_session(self):
        table = self.create_table(configured=False)

        with self.assertRaises(HTTPException) as arrival_error:
            list_arrival_bookings(table.id, self.db)
        self.assertEqual(arrival_error.exception.status_code, 409)

        with self.assertRaises(HTTPException) as receive_error:
            receive_table_guests(
                table.id,
                NhanKhachBanRequest(),
                self.user,
                self.db,
            )
        self.assertEqual(receive_error.exception.status_code, 409)
        self.assertIn("chưa được cấu hình", receive_error.exception.detail)
        self.db.expire_all()
        self.assertEqual(self.db.get(Ban, table.id).trang_thai, "TRONG")
        self.assertIsNone(
            self.db.scalar(
                select(PhienBan).where(PhienBan.ban_id == table.id)
            )
        )

    def test_unconfigured_table_is_not_available_or_assignable_for_booking(self):
        table = self.create_table(configured=False)
        booking_day = datetime.now(VIETNAM_TZ).date() + timedelta(days=1)
        booking = DatBan(
            ho_ten_khach="Khách kiểm thử",
            so_dien_thoai="0911111111",
            so_luong_khach=2,
            ngay_dat=booking_day,
            gio_bat_dau=time(12, 0),
            thoi_luong_giu_ban=90,
            trang_thai="CHO_XAC_NHAN",
        )
        self.db.add(
            LichHoatDong(
                thu=booking_day.weekday(),
                la_ngay_nghi=False,
                gio_mo_cua=time(8, 0),
                gio_dong_cua=time(23, 0),
            )
        )
        self.db.add(booking)
        self.db.commit()

        availability = lay_ban_trong(
            booking.id,
            self.user,
            self.db,
        )
        self.assertEqual(availability["so_ban_trong"], 0)
        self.assertEqual(availability["ban_trong"], [])

        manager = SimpleNamespace(id=self.employee_id, vai_tro="QUAN_LY")
        with self.assertRaises(HTTPException) as assignment_error:
            xac_nhan_va_phan_ban(
                booking.id,
                XacNhanDatBan(ban_id=table.id),
                manager,
                self.db,
            )
        self.assertEqual(assignment_error.exception.status_code, 409)
        self.assertIn(
            "chưa được cấu hình",
            assignment_error.exception.detail,
        )
        self.db.expire_all()
        self.assertIsNone(self.db.get(DatBan, booking.id).ban_id)
        self.assertEqual(self.db.get(Ban, table.id).trang_thai, "TRONG")


if __name__ == "__main__":
    unittest.main()
