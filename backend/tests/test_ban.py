"""Integration tests using an isolated, disposable PostgreSQL database."""
import os
import subprocess
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from types import SimpleNamespace

import psycopg2
from psycopg2 import sql
from sqlalchemy.engine import make_url


class BanIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_database_url = os.environ["DATABASE_URL"]
        source = make_url(os.environ["DATABASE_URL"])
        cls.database_name = "test_s107_" + uuid.uuid4().hex
        cls.admin = psycopg2.connect(source.set(drivername="postgresql").render_as_string(hide_password=False))
        cls.admin.autocommit = True
        with cls.admin.cursor() as cursor:
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(cls.database_name)))
        cls.addClassCleanup(cls.drop_database)
        os.environ["DATABASE_URL"] = source.set(database=cls.database_name).render_as_string(hide_password=False)
        subprocess.run(["alembic", "upgrade", "head"], check=True)
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database.session import engine, SessionLocal
        from app.dependencies.auth import get_current_user, require_manager
        from app.models.khu_vuc import KhuVuc
        from types import SimpleNamespace
        cls.app, cls.engine, cls.sessions = app, engine, SessionLocal
        cls.manager_dependency = staticmethod(require_manager)
        cls.user_dependency = staticmethod(get_current_user)
        app.dependency_overrides[require_manager] = lambda: None
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
            vai_tro="QUAN_LY"
        )
        cls.client = TestClient(app)
        with SessionLocal() as db:
            area = KhuVuc(ten_khu_vuc="Tầng 1 — sân vườn")
            other = KhuVuc(ten_khu_vuc="Phòng riêng")
            db.add_all([area, other])
            db.commit()
            cls.area_id, cls.other_area_id = area.id, other.id

    @classmethod
    def drop_database(cls):
        if hasattr(cls, "client"):
            cls.client.close()
            cls.app.dependency_overrides.clear()
            cls.engine.dispose()
        with cls.admin.cursor() as cursor:
            cursor.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(cls.database_name)))
        cls.admin.close()
        os.environ["DATABASE_URL"] = cls.original_database_url

    def payload(self, **changes):
        return {"ma_ban": "B-" + uuid.uuid4().hex[:10], "khu_vuc_id": self.area_id,
                "suc_chua_toi_thieu": 2, "suc_chua_toi_da": 6, "loai_ban": "THUONG", "trang_thai": "TRONG", **changes}

    def create(self, **changes):
        area_id = changes.pop("khu_vuc_id", self.area_id)
        response = self.client.post(
            "/api/ban",
            json={"khu_vuc_id": area_id},
        )
        self.assertEqual(response.status_code, 201, response.text)
        row = response.json()
        from app.models.ban import Ban
        from app.schemas.ban import BanResponse

        configured_values = {
            "ma_ban": row["ma_ban"],
            "suc_chua_toi_thieu": 2,
            "suc_chua_toi_da": 6,
            "loai_ban": "THUONG",
            "trang_thai": "TRONG",
            **changes,
        }
        with self.sessions() as db:
            table = db.get(Ban, row["id"])
            self.assertIsNotNone(table, f"Created table disappeared: {row}")
            for field, value in configured_values.items():
                setattr(table, field, value)
            table.da_cau_hinh = True
            db.commit()
            db.refresh(table)
            return BanResponse.model_validate(table).model_dump(mode="json")

    def test_auto_generated_codes_are_stable_and_concurrent(self):
        from app.models.khu_vuc import KhuVuc

        with self.sessions() as db:
            code_area = KhuVuc(ten_khu_vuc="Tầng mã " + uuid.uuid4().hex)
            concurrent_area = KhuVuc(
                ten_khu_vuc="Tầng đồng thời " + uuid.uuid4().hex
            )
            db.add_all([code_area, concurrent_area])
            db.commit()
            code_area_id = code_area.id
            concurrent_area_id = concurrent_area.id

        first = self.client.post(
            "/api/ban",
            json={"khu_vuc_id": code_area_id},
        )
        self.assertEqual(first.status_code, 201, first.text)
        first_table = first.json()
        self.assertEqual(first_table["ma_ban"], f"KV{code_area_id}-001")
        self.assertFalse(first_table["da_cau_hinh"])
        self.assertIsNone(first_table["suc_chua_toi_thieu"])
        self.assertIsNone(first_table["suc_chua_toi_da"])
        self.assertIsNone(first_table["loai_ban"])
        self.assertTrue(first_table["qr_token"])
        self.assertEqual(
            self.client.get(
                f'/api/ban/{first_table["id"]}/qr.png'
            ).status_code,
            409,
        )
        self.assertEqual(
            self.client.get(
                f'/api/ban/khu-vuc/{code_area_id}/qr.pdf'
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                f'/api/ban/qr/{first_table["qr_token"]}'
            ).status_code,
            409,
        )

        with self.sessions() as db:
            area = db.get(KhuVuc, code_area_id)
            area.ten_khu_vuc = "Khu vực đã đổi tên"
            area.thu_tu_hien_thi = 99
            db.commit()

        second = self.client.post(
            "/api/ban",
            json={"khu_vuc_id": code_area_id},
        )
        self.assertEqual(second.status_code, 201, second.text)
        self.assertEqual(second.json()["ma_ban"], f"KV{code_area_id}-002")

        with ThreadPoolExecutor(max_workers=6) as pool:
            responses = list(
                pool.map(
                    lambda _: self.client.post(
                        "/api/ban",
                        json={"khu_vuc_id": concurrent_area_id},
                    ),
                    range(6),
                )
            )
        self.assertTrue(
            all(response.status_code == 201 for response in responses),
            [response.text for response in responses],
        )
        codes = [response.json()["ma_ban"] for response in responses]
        self.assertEqual(len(set(codes)), 6)
        self.assertTrue(
            all(code.startswith(f"KV{concurrent_area_id}-") for code in codes)
        )

        rejected_manual_code = self.client.post(
            "/api/ban",
            json={"khu_vuc_id": code_area_id, "ma_ban": "MANUAL"},
        )
        self.assertEqual(rejected_manual_code.status_code, 422)

    def test_routes_registered_in_main(self):
        paths = self.client.get('/openapi.json').json()['paths']
        expected = {
            '/api/ban': {'get', 'post'},
            '/api/ban/{table_id}': {'get', 'put', 'delete'},
            '/api/ban/qr/{token}': {'get'},
            '/api/ban/{table_id}/qr/regenerate': {'post'},
            '/api/ban/{table_id}/qr.png': {'get'},
            '/api/ban/khu-vuc/{area_id}/qr.pdf': {'get'},
        }
        for path, methods in expected.items():
            with self.subTest(path=path):
                self.assertIn(path, paths)
                self.assertTrue(methods <= paths[path].keys())
        self.assertIn('/api/khu-vuc', paths)
        row = self.create()
        self.assertEqual(self.client.get(f'/api/ban/{row["id"]}').json()['id'], row['id'])

    def test_delete_table_and_tokens(self):
        from sqlalchemy import select
        from app.models.ban import Ban, BanQRToken
        other = self.create()
        for table_status in ['TRONG', 'DA_DAT', 'DANG_SU_DUNG', 'NGUNG_SU_DUNG']:
            with self.subTest(table_status=table_status):
                row = self.create(trang_thai=table_status)
                rotated = self.client.post(f'/api/ban/{row["id"]}/qr/regenerate').json()
                result = self.client.delete(f'/api/ban/{row["id"]}')
                self.assertEqual(result.status_code, 204)
                self.assertEqual(result.content, b'')
                with self.sessions() as db:
                    self.assertIsNone(db.get(Ban, row['id']))
                    self.assertIsNone(db.scalar(select(BanQRToken).where(BanQRToken.ban_id == row['id'])))
                    self.assertIsNotNone(db.get(BanQRToken, other['qr_token']))
                self.assertEqual(self.client.get(f'/api/ban/{row["id"]}').status_code, 404)
                self.assertEqual(self.client.delete(f'/api/ban/{row["id"]}').status_code, 404)
                for token in [row['qr_token'], rotated['qr_token']]:
                    self.assertEqual(self.client.get('/api/ban/qr/' + token).status_code, 404)
                listed = self.client.get(f'/api/ban?khu_vuc_id={row["khu_vuc_id"]}').json()
                self.assertNotIn(row['id'], [item['id'] for item in listed])
        self.assertEqual(self.client.get(f'/api/ban/{other["id"]}').json(), other)

    def test_delete_last_table_allows_area_deletion(self):
        from app.models.khu_vuc import KhuVuc
        area = self.client.post('/api/khu-vuc', json={'ten_khu_vuc': 'Xóa bàn ' + uuid.uuid4().hex}).json()
        first = self.create(khu_vuc_id=area['id'])
        last = self.create(khu_vuc_id=area['id'], trang_thai='NGUNG_SU_DUNG')
        self.assertEqual(self.client.patch(f'/api/khu-vuc/{area["id"]}/ngung-su-dung').status_code, 200)
        self.assertEqual(self.client.delete(f'/api/khu-vuc/{area["id"]}').status_code, 409)
        self.assertEqual(self.client.delete(f'/api/ban/{first["id"]}').status_code, 204)
        self.assertEqual(self.client.delete(f'/api/khu-vuc/{area["id"]}').status_code, 409)
        self.assertEqual(self.client.delete(f'/api/ban/{last["id"]}').status_code, 204)
        self.assertEqual(self.client.get(f'/api/ban?khu_vuc_id={area["id"]}').json(), [])
        self.assertEqual(self.client.delete(f'/api/khu-vuc/{area["id"]}').status_code, 204)
        with self.sessions() as db:
            self.assertIsNone(db.get(KhuVuc, area['id']))

    def test_validation(self):
        for change in [
            {"ma_ban": "MANUAL"},
            {"suc_chua_toi_thieu": 0},
            {"loai_ban": "INVALID"},
            {"trang_thai": "INVALID"},
            {"qr_token": "provided"},
        ]:
            with self.subTest(change=change):
                response = self.client.post(
                    "/api/ban",
                    json={"khu_vuc_id": self.area_id, **change},
                )
                self.assertEqual(response.status_code, 422)
        self.assertEqual(
            self.client.post(
                "/api/ban",
                json={"khu_vuc_id": 2147483647},
            ).status_code,
            404,
        )

    def test_edit_filter_and_duplicate_update(self):
        row, other = self.create(), self.create()
        payload = {
            "suc_chua_toi_thieu": 2,
            "suc_chua_toi_da": 8,
            "loai_ban": "PHONG_RIENG",
        }
        result = self.client.put(f'/api/ban/{row["id"]}', json=payload)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["khu_vuc_id"], row["khu_vuc_id"])
        self.assertEqual(result.json()["qr_token"], row["qr_token"])
        self.assertEqual(result.json()["ma_ban"], row["ma_ban"])
        listed = self.client.get(f'/api/ban?khu_vuc_id={self.area_id}').json()
        self.assertIn(row["id"], [item["id"] for item in listed])
        self.assertTrue(all(item["khu_vuc_id"] == self.area_id for item in listed))
        other_area_tables = self.client.get(
            f'/api/ban?khu_vuc_id={self.other_area_id}'
        ).json()
        self.assertNotIn(row["id"], [item["id"] for item in other_area_tables])
        self.assertEqual(
            self.client.put(
                f'/api/ban/{row["id"]}',
                json={**payload, "ma_ban": other["ma_ban"]},
            ).status_code,
            422,
        )

    def test_table_map_list_returns_complete_tables_for_each_area(self):
        from app.models.khu_vuc import KhuVuc

        statuses = ("TRONG", "DA_DAT", "DANG_SU_DUNG", "DANG_DON")
        first_area = KhuVuc(
            ten_khu_vuc="Sơ đồ test A " + uuid.uuid4().hex
        )
        second_area = KhuVuc(
            ten_khu_vuc="Sơ đồ test B " + uuid.uuid4().hex
        )
        with self.sessions() as db:
            db.add_all([first_area, second_area])
            db.commit()
            first_area_id = first_area.id
            second_area_id = second_area.id

        first_area_tables = [
            self.create(
                khu_vuc_id=first_area_id,
                trang_thai=status,
                suc_chua_toi_thieu=2 + index,
                suc_chua_toi_da=6 + index,
            )
            for index, status in enumerate(statuses)
        ]
        second_area_tables = [
            self.create(
                khu_vuc_id=second_area_id,
                trang_thai="DANG_DON",
            ),
            self.create(
                khu_vuc_id=second_area_id,
                trang_thai="NGUNG_SU_DUNG",
            ),
        ]

        all_tables = self.client.get("/api/ban")
        self.assertEqual(all_tables.status_code, 200, all_tables.text)
        all_rows = all_tables.json()
        self.assertEqual(
            {
                row["id"]
                for row in all_rows
                if row["khu_vuc_id"] in {first_area_id, second_area_id}
            },
            {row["id"] for row in first_area_tables}
            | {row["id"] for row in second_area_tables},
        )
        self.assertEqual(
            {
                row["id"]: row["trang_thai"]
                for row in all_rows
                if row["khu_vuc_id"] == first_area_id
            },
            {
                row["id"]: row["trang_thai"]
                for row in first_area_tables
            },
        )
        for area_id in (first_area_id, second_area_id):
            response = self.client.get(
                "/api/ban",
                params={"khu_vuc_id": area_id},
            )
            self.assertEqual(response.status_code, 200, response.text)
            self.assertTrue(
                all(row["khu_vuc_id"] == area_id for row in response.json())
            )
            self.assertEqual(
                {row["khu_vuc_id"] for row in response.json()},
                {area_id},
            )
        for row, expected_min, expected_max in zip(
            first_area_tables,
            range(2, 6),
            range(6, 10),
        ):
            with self.subTest(table_id=row["id"]):
                self.assertTrue(row["ma_ban"])
                self.assertEqual(row["khu_vuc_id"], first_area_id)
                self.assertEqual(row["suc_chua_toi_thieu"], expected_min)
                self.assertEqual(row["suc_chua_toi_da"], expected_max)

    def test_demo_seed_is_idempotent_and_does_not_overwrite_existing_tables(self):
        from sqlalchemy import select
        from app.models.ban import Ban
        from app.seed_table_map_demo import seed_table_map_demo

        self.assertEqual(seed_table_map_demo(), (2, 8))

        with self.sessions() as db:
            seeded_tables = list(
                db.scalars(
                    select(Ban).where(
                        Ban.ma_ban.like("S207-DEMO-%")
                    )
                )
            )
            self.assertEqual(len(seeded_tables), 8)
            first_table = next(
                table
                for table in seeded_tables
                if table.ma_ban == "S207-DEMO-A-01"
            )
            first_table.trang_thai = "DANG_SU_DUNG"
            db.commit()

        self.assertEqual(seed_table_map_demo(), (0, 0))

        with self.sessions() as db:
            seeded_tables = list(
                db.scalars(
                    select(Ban).where(
                        Ban.ma_ban.like("S207-DEMO-%")
                    )
                )
            )
            self.assertEqual(len(seeded_tables), 8)
            self.assertEqual(
                next(
                    table.trang_thai
                    for table in seeded_tables
                    if table.ma_ban == "S207-DEMO-A-01"
                ),
                "DANG_SU_DUNG",
            )

    def test_configure_new_table_and_update_preserves_identity_and_status(self):
        unconfigured = self.client.post(
            "/api/ban",
            json={"khu_vuc_id": self.area_id},
        ).json()
        request = {
            "suc_chua_toi_thieu": 2,
            "suc_chua_toi_da": 8,
            "loai_ban": "PHONG_RIENG",
        }

        activated = self.client.put(
            f'/api/ban/{unconfigured["id"]}',
            json=request,
        )
        self.assertEqual(activated.status_code, 200, activated.text)
        configured = activated.json()
        self.assertTrue(configured["da_cau_hinh"])
        self.assertEqual(configured["trang_thai"], "TRONG")
        self.assertEqual(configured["id"], unconfigured["id"])
        self.assertEqual(configured["ma_ban"], unconfigured["ma_ban"])
        self.assertEqual(configured["qr_token"], unconfigured["qr_token"])
        self.assertEqual(configured["khu_vuc_id"], unconfigured["khu_vuc_id"])

        reserved = self.create(trang_thai="DA_DAT")
        update = self.client.put(
            f'/api/ban/{reserved["id"]}',
            json={
                "suc_chua_toi_thieu": 3,
                "suc_chua_toi_da": 9,
                "loai_ban": "PHONG_RIENG",
            },
        )
        self.assertEqual(update.status_code, 200, update.text)
        changed = update.json()
        self.assertEqual(changed["trang_thai"], "DA_DAT")
        self.assertEqual(changed["id"], reserved["id"])
        self.assertEqual(changed["ma_ban"], reserved["ma_ban"])
        self.assertEqual(changed["qr_token"], reserved["qr_token"])
        self.assertEqual(changed["khu_vuc_id"], reserved["khu_vuc_id"])

    def test_invalid_or_failed_configuration_leaves_table_unconfigured(self):
        from sqlalchemy import text

        unconfigured = self.client.post(
            "/api/ban",
            json={"khu_vuc_id": self.area_id},
        ).json()
        invalid = self.client.put(
            f'/api/ban/{unconfigured["id"]}',
            json={
                "suc_chua_toi_thieu": 5,
                "suc_chua_toi_da": 4,
                "loai_ban": "THUONG",
            },
        )
        self.assertEqual(invalid.status_code, 422)

        with self.sessions() as db:
            db.execute(
                text(
                    "ALTER TABLE ban ADD CONSTRAINT "
                    "ck_test_reject_private_table "
                    f"CHECK (id <> {unconfigured['id']} "
                    "OR loai_ban <> 'PHONG_RIENG')"
                )
            )
            db.commit()
        try:
            failed_save = self.client.put(
                f'/api/ban/{unconfigured["id"]}',
                json={
                    "suc_chua_toi_thieu": 1,
                    "suc_chua_toi_da": 6,
                    "loai_ban": "PHONG_RIENG",
                },
            )
            self.assertEqual(failed_save.status_code, 409, failed_save.text)
            unchanged = self.client.get(
                f'/api/ban/{unconfigured["id"]}'
            ).json()
            self.assertFalse(unchanged["da_cau_hinh"])
            self.assertIsNone(unchanged["suc_chua_toi_thieu"])
            self.assertIsNone(unchanged["suc_chua_toi_da"])
            self.assertIsNone(unchanged["loai_ban"])
            self.assertEqual(unchanged["trang_thai"], "TRONG")
        finally:
            with self.sessions() as db:
                db.execute(
                    text(
                        "ALTER TABLE ban DROP CONSTRAINT "
                        "ck_test_reject_private_table"
                    )
                )
                db.commit()

    def test_capacity_change_respects_current_guests_and_effective_bookings(self):
        from datetime import datetime, time, timedelta
        from zoneinfo import ZoneInfo

        from sqlalchemy import text

        from app.models.phien_ban import PhienBan

        def insert_booking(db, *, guest_count, booking_date, start_time, arrived_at):
            db.execute(
                text(
                    "INSERT INTO dat_ban "
                    "(ma_dat_ban, ho_ten_khach, so_dien_thoai, "
                    "so_luong_khach, ngay_dat, gio_bat_dau, "
                    "thoi_luong_giu_ban, trang_thai, ban_id, khach_toi_at) "
                    "VALUES (:code, :name, :phone, :guests, :booking_date, "
                    ":start_time, 90, 'DA_XAC_NHAN', :table_id, :arrived_at)"
                ),
                {
                    "code": uuid.uuid4().hex[:6],
                    "name": "Khách kiểm thử",
                    "phone": "0900000001",
                    "guests": guest_count,
                    "booking_date": booking_date,
                    "start_time": start_time,
                    "table_id": row["id"],
                    "arrived_at": arrived_at,
                },
            )

        row = self.create(trang_thai="DANG_SU_DUNG")
        session_start = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
        with self.sessions() as db:
            db.add(
                PhienBan(
                    ban_id=row["id"],
                    trang_thai="DANG_PHUC_VU",
                    bat_dau_at=session_start,
                )
            )
            insert_booking(
                db,
                guest_count=5,
                booking_date=session_start.date(),
                start_time=(session_start - timedelta(minutes=15))
                .time()
                .replace(tzinfo=None, second=0, microsecond=0),
                arrived_at=session_start,
            )
            db.commit()

        too_small_for_guests = self.client.put(
            f'/api/ban/{row["id"]}',
            json={
                "suc_chua_toi_thieu": 1,
                "suc_chua_toi_da": 4,
                "loai_ban": "THUONG",
            },
        )
        self.assertEqual(too_small_for_guests.status_code, 409)
        self.assertIn("5 khách đang ngồi", too_small_for_guests.json()["detail"])

        future = session_start.date() + timedelta(days=1)
        with self.sessions() as db:
            insert_booking(
                db,
                guest_count=8,
                booking_date=future,
                start_time=time(18, 0),
                arrived_at=None,
            )
            db.commit()

        too_small_for_booking = self.client.put(
            f'/api/ban/{row["id"]}',
            json={
                "suc_chua_toi_thieu": 1,
                "suc_chua_toi_da": 7,
                "loai_ban": "THUONG",
            },
        )
        self.assertEqual(too_small_for_booking.status_code, 409)
        self.assertIn(
            "đơn đặt bàn",
            too_small_for_booking.json()["detail"],
        )

    def test_rotation_and_public_scan(self):
        row = self.create()
        tokens = [row["qr_token"]]
        self.assertGreaterEqual(len(tokens[0]), 16)
        self.assertEqual(self.client.get('/api/ban/qr/' + tokens[0]).status_code, 200)
        for _ in range(2):
            response = self.client.post(f'/api/ban/{row["id"]}/qr/regenerate')
            self.assertEqual(response.status_code, 200)
            tokens.append(response.json()["qr_token"])
        self.assertEqual(len(set(tokens)), 3)
        for old in tokens[:-1]:
            response = self.client.get('/api/ban/qr/' + old)
            self.assertEqual(response.status_code, 410)
            self.assertIn("đã thay đổi", response.json()["detail"])
            self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(self.client.get('/api/ban/qr/' + tokens[-1]).status_code, 200)
        self.assertEqual(self.client.get('/api/ban/qr/unknown').status_code, 404)

    def test_concurrent_rotation(self):
        row = self.create()
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post(f'/api/ban/{row["id"]}/qr/regenerate'), range(2)))
        self.assertTrue(all(r.status_code == 200 for r in responses))
        tokens = [r.json()["qr_token"] for r in responses]
        self.assertEqual(len(set(tokens)), 2)
        statuses = sorted(self.client.get('/api/ban/qr/' + token).status_code for token in tokens)
        self.assertEqual(statuses, [200, 410])
        self.assertEqual(self.client.get('/api/ban/qr/' + row["qr_token"]).status_code, 410)

    def test_inactive_table_and_area(self):
        row = self.create(trang_thai="NGUNG_SU_DUNG")
        self.assertEqual(self.client.get('/api/ban/qr/' + row["qr_token"]).status_code, 409)
        from app.models.khu_vuc import KhuVuc
        with self.sessions() as db:
            area = KhuVuc(ten_khu_vuc="Ngừng " + uuid.uuid4().hex)
            db.add(area)
            db.commit()
            area_id = area.id
        row = self.create(khu_vuc_id=area_id)
        self.assertEqual(self.client.patch(f'/api/khu-vuc/{area_id}/ngung-su-dung').status_code, 200)
        self.assertEqual(self.client.get('/api/ban/qr/' + row["qr_token"]).status_code, 409)

    def test_inactive_area_is_preserved_and_cannot_be_changed_by_table_update(self):
        area_response = self.client.post('/api/khu-vuc', json={'ten_khu_vuc': 'Liên kết ' + uuid.uuid4().hex})
        self.assertEqual(area_response.status_code, 201)
        area_id = area_response.json()['id']
        old_table = self.create(khu_vuc_id=area_id)
        self.assertEqual(self.client.patch(f'/api/khu-vuc/{area_id}/ngung-su-dung').status_code, 200)

        existing_ids = {
            row["id"]
            for row in self.client.get(
                f'/api/ban?khu_vuc_id={area_id}'
            ).json()
        }
        rejected = self.client.post(
            '/api/ban',
            json={"khu_vuc_id": area_id},
        )
        self.assertEqual(rejected.status_code, 409)
        self.assertIn('Khu vực đã ngừng sử dụng', rejected.json()['detail'])
        listed = self.client.get(
            f'/api/ban?khu_vuc_id={area_id}'
        ).json()
        self.assertEqual({row["id"] for row in listed}, existing_ids)

        payload = {
            'suc_chua_toi_thieu': 3,
            'suc_chua_toi_da': 10,
            'loai_ban': 'PHONG_RIENG',
        }
        saved = self.client.put(f'/api/ban/{old_table["id"]}', json=payload)
        self.assertEqual(saved.status_code, 200)
        for field, value in payload.items():
            self.assertEqual(saved.json()[field], value)
        self.assertEqual(saved.json()['khu_vuc_id'], area_id)
        self.assertEqual(saved.json()['trang_thai'], old_table['trang_thai'])
        self.assertEqual(saved.json()['ma_ban'], old_table['ma_ban'])
        self.assertEqual(saved.json()['qr_token'], old_table['qr_token'])
        self.assertEqual(self.client.get(f'/api/ban/{old_table["id"]}').json(), saved.json())

        move_attempt = self.client.put(
            f'/api/ban/{old_table["id"]}',
            json={**payload, 'khu_vuc_id': self.area_id},
        )
        self.assertEqual(move_attempt.status_code, 422)
        unchanged = self.client.get(f'/api/ban/{old_table["id"]}').json()
        self.assertEqual(unchanged, saved.json())

        self.assertEqual(self.client.patch(f'/api/khu-vuc/{area_id}/kich-hoat').status_code, 200)
        created = self.client.post(
            '/api/ban',
            json={"khu_vuc_id": area_id},
        )
        self.assertEqual(created.status_code, 201, created.text)

    def test_downloads(self):
        from PIL import Image
        from pypdf import PdfReader
        from pathlib import Path
        from app.core.config import settings
        from app.models.khu_vuc import KhuVuc
        # This test runs inside Linux Docker without a host font mount.
        self.assertTrue(Path(settings.qr_pdf_font_path).is_file())
        self.assertTrue(settings.qr_pdf_font_path.startswith('/usr/share/fonts/'))
        self.assertFalse(Path('C:/Windows/Fonts/arial.ttf').is_file())
        with self.sessions() as db:
            area = KhuVuc(ten_khu_vuc='PDF Tầng 1 — sân vườn')
            empty = KhuVuc(ten_khu_vuc='PDF rỗng')
            db.add_all([area, empty])
            db.commit()
            area_id, empty_id = area.id, empty.id
        rows = [self.create(khu_vuc_id=area_id, trang_thai='NGUNG_SU_DUNG' if i == 7 else 'TRONG') for i in range(8)]
        outside = self.create()
        row = rows[0]
        png = self.client.get(f'/api/ban/{row["id"]}/qr.png')
        self.assertEqual(png.status_code, 200)
        self.assertEqual(png.headers["content-type"], "image/png")
        self.assertIn('attachment;', png.headers['content-disposition'])
        Image.open(BytesIO(png.content)).verify()
        result = self.client.get(f'/api/ban/khu-vuc/{area_id}/qr.pdf')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.headers["content-type"], "application/pdf")
        self.assertIn('attachment;', result.headers['content-disposition'])
        pdf = PdfReader(BytesIO(result.content))
        self.assertEqual(len(pdf.pages), 2)
        self.assertEqual(sum(len(page.images) for page in pdf.pages), 8)
        text = " ".join(page.extract_text() for page in pdf.pages)
        self.assertIn("Tầng 1 — sân vườn", text)
        for row in rows:
            self.assertIn(row['ma_ban'], text)
        self.assertNotIn(outside['ma_ban'], text)
        self.assertEqual(self.client.get(f'/api/ban/khu-vuc/{empty_id}/qr.pdf').status_code, 404)
        self.assertEqual(self.client.get('/api/ban/khu-vuc/2147483647/qr.pdf').status_code, 404)

    def test_real_login_cookie_and_qr_persistence(self):
        from fastapi.testclient import TestClient
        from app.core.security import hash_password
        from app.models.nhan_vien import NhanVien
        password = 's107-test-password'
        with self.sessions() as db:
            for name, role in [('s107-manager', 'QUAN_LY'), ('s107-staff', 'PHUC_VU')]:
                db.add(NhanVien(ten_dang_nhap=name, so_dien_thoai=name,
                               mat_khau=hash_password(password), ho_ten=name, vai_tro=role))
            db.commit()
        self.app.dependency_overrides.clear()
        try:
            with TestClient(self.app) as client:
                login = client.post('/api/auth/login', json={'identifier': 's107-manager', 'password': password})
                self.assertEqual(login.status_code, 200)
                self.assertEqual(login.json()['user']['role'], 'QUAN_LY')
                created = client.post(
                    '/api/ban',
                    json={"khu_vuc_id": self.area_id},
                )
                self.assertEqual(created.status_code, 201)
                unconfigured = created.json()
                configured = client.put(
                    f'/api/ban/{unconfigured["id"]}',
                    json={
                        "suc_chua_toi_thieu": 2,
                        "suc_chua_toi_da": 6,
                        "loai_ban": "THUONG",
                    },
                )
                self.assertEqual(configured.status_code, 200)
                row = configured.json()
                rotated = client.post(f'/api/ban/{row["id"]}/qr/regenerate')
                self.assertEqual(rotated.status_code, 200)
                token = rotated.json()['qr_token']
                self.assertEqual(client.get(f'/api/ban/{row["id"]}/qr.png').status_code, 200)
            # A fresh Python process must recognize old/new QR from PostgreSQL.
            script = (
                'import sys; from fastapi.testclient import TestClient; from app.main import app; '
                'c=TestClient(app); '
                'assert c.get("/api/ban/qr/"+sys.argv[1]).status_code == 410; '
                'assert c.get("/api/ban/qr/"+sys.argv[2]).status_code == 200'
            )
            subprocess.run(['python', '-c', script, row['qr_token'], token], check=True)
            with TestClient(self.app) as staff:
                self.assertEqual(staff.post('/api/auth/login', json={'identifier': 's107-staff', 'password': password}).status_code, 200)
                self.assertEqual(staff.get('/api/ban').status_code, 200)
                self.assertEqual(staff.get('/api/khu-vuc').status_code, 200)
        finally:
            self.app.dependency_overrides[self.manager_dependency] = lambda: None
            self.app.dependency_overrides[self.user_dependency] = (
                lambda: SimpleNamespace(vai_tro="QUAN_LY")
            )

    def test_permissions(self):
        from app.dependencies.auth import get_current_user
        from types import SimpleNamespace
        row = self.create()
        self.app.dependency_overrides.clear()
        read_routes = [
            ('get', '/api/ban'),
            ('get', f'/api/ban/{row["id"]}'),
            ('get', '/api/khu-vuc'),
            ('get', '/api/khu-vuc/active'),
        ]
        manager_routes = [
            ('post', '/api/ban'),
            ('get', '/api/ban/availability?ma_ban=TEST'),
            ('put', f'/api/ban/{row["id"]}'),
            ('delete', f'/api/ban/{row["id"]}'),
            ('post', f'/api/ban/{row["id"]}/qr/regenerate'),
            ('get', f'/api/ban/{row["id"]}/qr.png'),
            ('get', f'/api/ban/khu-vuc/{self.area_id}/qr.pdf'),
        ]
        routes = read_routes + manager_routes
        def request_body(method, path):
            if method == 'post' and path == '/api/ban':
                return {"khu_vuc_id": self.area_id}
            if method == 'put':
                return {
                    "suc_chua_toi_thieu": 1,
                    "suc_chua_toi_da": 4,
                    "loai_ban": "THUONG",
                }
            return None

        try:
            for method, path in routes:
                self.assertEqual(
                    self.client.request(
                        method,
                        path,
                        json=request_body(method, path),
                    ).status_code,
                    401,
                )
            self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(vai_tro="PHUC_VU")
            for method, path in read_routes:
                self.assertEqual(self.client.request(method, path).status_code, 200)
            for method, path in manager_routes:
                self.assertEqual(
                    self.client.request(
                        method,
                        path,
                        json=request_body(method, path),
                    ).status_code,
                    403,
                )
            self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(vai_tro="NHAN_VIEN")
            for method, path in routes:
                if (method, path) == ('get', '/api/khu-vuc/active'):
                    self.assertEqual(self.client.request(method, path).status_code, 200)
                    continue
                self.assertEqual(
                    self.client.request(
                        method,
                        path,
                        json=request_body(method, path),
                    ).status_code,
                    403,
                )
            self.assertEqual(self.client.get('/api/ban/qr/' + row["qr_token"]).status_code, 200)
        finally:
            self.app.dependency_overrides.clear()
            self.app.dependency_overrides[self.manager_dependency] = lambda: None
            self.app.dependency_overrides[self.user_dependency] = (
                lambda: SimpleNamespace(vai_tro="QUAN_LY")
            )


if __name__ == "__main__":
    unittest.main()
