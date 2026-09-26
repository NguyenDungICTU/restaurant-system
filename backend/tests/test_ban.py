"""Integration tests using an isolated, disposable PostgreSQL database."""
import os
import subprocess
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

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
        from app.dependencies.auth import require_manager
        from app.models.khu_vuc import KhuVuc
        cls.app, cls.engine, cls.sessions = app, engine, SessionLocal
        cls.manager_dependency = staticmethod(require_manager)
        app.dependency_overrides[require_manager] = lambda: None
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
        response = self.client.post("/api/ban", json=self.payload(**changes))
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

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

    def test_unique_normalized_code(self):
        row = self.create()
        response = self.client.post("/api/ban", json=self.payload(ma_ban=" " + row["ma_ban"].lower() + " "))
        self.assertEqual(response.status_code, 409)

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
        for change in [{"ma_ban": "  "}, {"suc_chua_toi_thieu": 0}, {"suc_chua_toi_da": 1},
                       {"loai_ban": "INVALID"}, {"trang_thai": "INVALID"}, {"qr_token": "provided"}]:
            with self.subTest(change=change):
                self.assertEqual(self.client.post("/api/ban", json=self.payload(**change)).status_code, 422)
        self.assertEqual(self.client.post("/api/ban", json=self.payload(khu_vuc_id=2147483647)).status_code, 404)

    def test_edit_filter_and_duplicate_update(self):
        row, other = self.create(), self.create()
        payload = self.payload(ma_ban=row["ma_ban"], khu_vuc_id=self.other_area_id, loai_ban="PHONG_RIENG")
        result = self.client.put(f'/api/ban/{row["id"]}', json=payload)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["qr_token"], row["qr_token"])
        listed = self.client.get(f'/api/ban?khu_vuc_id={self.other_area_id}').json()
        self.assertIn(row["id"], [item["id"] for item in listed])
        self.assertTrue(all(item["khu_vuc_id"] == self.other_area_id for item in listed))
        payload["ma_ban"] = other["ma_ban"]
        self.assertEqual(self.client.put(f'/api/ban/{row["id"]}', json=payload).status_code, 409)

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

    def test_inactive_area_can_be_kept_but_not_assigned(self):
        area_response = self.client.post('/api/khu-vuc', json={'ten_khu_vuc': 'Liên kết ' + uuid.uuid4().hex})
        self.assertEqual(area_response.status_code, 201)
        area_id = area_response.json()['id']
        old_table = self.create(khu_vuc_id=area_id)
        active_table = self.create()
        self.assertEqual(self.client.patch(f'/api/khu-vuc/{area_id}/ngung-su-dung').status_code, 200)

        new_payload = self.payload(khu_vuc_id=area_id)
        rejected = self.client.post('/api/ban', json=new_payload)
        self.assertEqual(rejected.status_code, 409)
        self.assertIn('Khu vực đã ngừng sử dụng', rejected.json()['detail'])
        listed = self.client.get('/api/ban').json()
        self.assertNotIn(new_payload['ma_ban'], [row['ma_ban'] for row in listed])

        other_area = self.client.post('/api/khu-vuc', json={'ten_khu_vuc': 'Ngừng khác ' + uuid.uuid4().hex}).json()
        self.assertEqual(self.client.patch(f'/api/khu-vuc/{other_area["id"]}/ngung-su-dung').status_code, 200)

        # Reject moving from either an active or inactive area to another inactive area.
        for row, target in [(active_table, area_id), (old_table, other_area['id'])]:
            payload = self.payload(khu_vuc_id=target, ma_ban=row['ma_ban'], suc_chua_toi_da=10)
            response = self.client.put(f'/api/ban/{row["id"]}', json=payload)
            self.assertEqual(response.status_code, 409)
            self.assertIn('Khu vực đã ngừng sử dụng', response.json()['detail'])
            unchanged = self.client.get(f'/api/ban/{row["id"]}').json()
            self.assertEqual(unchanged, row)

        # Keeping the original inactive area allows editing all other table fields.
        payload = self.payload(khu_vuc_id=area_id, suc_chua_toi_thieu=3, suc_chua_toi_da=10,
                               loai_ban='PHONG_RIENG', trang_thai='DA_DAT')
        saved = self.client.put(f'/api/ban/{old_table["id"]}', json=payload)
        self.assertEqual(saved.status_code, 200)
        for field, value in payload.items():
            self.assertEqual(saved.json()[field], value.upper() if field == 'ma_ban' else value)
        self.assertEqual(saved.json()['qr_token'], old_table['qr_token'])
        self.assertEqual(self.client.get(f'/api/ban/{old_table["id"]}').json(), saved.json())

        # An old table can be moved to an active area without losing its identity.
        payload = self.payload(ma_ban=old_table['ma_ban'], khu_vuc_id=self.area_id)
        moved = self.client.put(f'/api/ban/{old_table["id"]}', json=payload)
        self.assertEqual(moved.status_code, 200)
        self.assertEqual(moved.json()['khu_vuc_id'], self.area_id)
        self.assertEqual(moved.json()['qr_token'], old_table['qr_token'])

        self.assertEqual(self.client.patch(f'/api/khu-vuc/{area_id}/kich-hoat').status_code, 200)
        self.assertEqual(self.client.post('/api/ban', json=new_payload).status_code, 201)

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
                created = client.post('/api/ban', json=self.payload())
                self.assertEqual(created.status_code, 201)
                row = created.json()
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
                self.assertEqual(staff.get('/api/ban').status_code, 403)
        finally:
            self.app.dependency_overrides[self.manager_dependency] = lambda: None

    def test_permissions(self):
        from app.dependencies.auth import get_current_user
        from types import SimpleNamespace
        row = self.create()
        self.app.dependency_overrides.clear()
        routes = [('get', '/api/ban'), ('post', '/api/ban'), ('get', f'/api/ban/{row["id"]}'), ('put', f'/api/ban/{row["id"]}'),
                  ('delete', f'/api/ban/{row["id"]}'),
                  ('post', f'/api/ban/{row["id"]}/qr/regenerate'), ('get', f'/api/ban/{row["id"]}/qr.png'),
                  ('get', f'/api/ban/khu-vuc/{self.area_id}/qr.pdf')]
        try:
            for method, path in routes:
                self.assertEqual(self.client.request(method, path, json=self.payload()).status_code, 401)
            self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(vai_tro="NHAN_VIEN")
            for method, path in routes:
                self.assertEqual(self.client.request(method, path, json=self.payload()).status_code, 403)
            self.assertEqual(self.client.get('/api/ban/qr/' + row["qr_token"]).status_code, 200)
        finally:
            self.app.dependency_overrides.clear()
            self.app.dependency_overrides[self.manager_dependency] = lambda: None


if __name__ == "__main__":
    unittest.main()
