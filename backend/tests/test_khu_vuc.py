"""Area deletion API tests on a disposable PostgreSQL database."""
import os
import subprocess
import unittest
import uuid
from types import SimpleNamespace

import psycopg2
from psycopg2 import sql
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker


class AreaDeletionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = make_url(os.environ['DATABASE_URL'])
        cls.name = 'test_s106_' + uuid.uuid4().hex
        cls.admin = psycopg2.connect(source.set(drivername='postgresql').render_as_string(hide_password=False))
        cls.admin.autocommit = True
        with cls.admin.cursor() as cursor:
            cursor.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(cls.name)))
        cls.addClassCleanup(cls.cleanup_database)
        url = source.set(database=cls.name).render_as_string(hide_password=False)
        subprocess.run(['alembic', 'upgrade', 'head'], env={**os.environ, 'DATABASE_URL': url}, check=True)
        cls.engine = create_engine(url)
        cls.sessions = sessionmaker(bind=cls.engine, expire_on_commit=False)
        from fastapi.testclient import TestClient
        from app.main import app
        cls.app = app
        cls.client = TestClient(app)

    @classmethod
    def cleanup_database(cls):
        if hasattr(cls, 'client'):
            cls.client.close()
            cls.app.dependency_overrides.clear()
        if hasattr(cls, 'engine'):
            cls.engine.dispose()
        with cls.admin.cursor() as cursor:
            cursor.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(cls.name)))
        cls.admin.close()

    def setUp(self):
        from app.database.session import get_db
        from app.dependencies.auth import get_current_user

        def database():
            with self.sessions() as db:
                yield db

        self.app.dependency_overrides[get_db] = database
        self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(vai_tro='QUAN_LY')
        self.addCleanup(self.app.dependency_overrides.clear)

    def create_area(self):
        response = self.client.post('/api/khu-vuc', json={'ten_khu_vuc': 'Xóa ' + uuid.uuid4().hex})
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_delete_empty_area_active_or_inactive(self):
        from app.models.khu_vuc import KhuVuc
        for inactive in [False, True]:
            with self.subTest(inactive=inactive):
                area = self.create_area()
                if inactive:
                    self.assertEqual(self.client.patch(f'/api/khu-vuc/{area["id"]}/ngung-su-dung').status_code, 200)
                response = self.client.delete(f'/api/khu-vuc/{area["id"]}')
                self.assertEqual(response.status_code, 204)
                self.assertEqual(response.content, b'')
                with self.sessions() as db:
                    self.assertIsNone(db.get(KhuVuc, area['id']))
                self.assertNotIn(area['id'], [row['id'] for row in self.client.get('/api/khu-vuc').json()])
                self.assertEqual(self.client.delete(f'/api/khu-vuc/{area["id"]}').status_code, 404)

    def test_area_with_any_table_is_preserved(self):
        from app.models.ban import BanQRToken
        for inactive_area in [False, True]:
            for table_status in ['TRONG', 'NGUNG_SU_DUNG']:
                with self.subTest(inactive_area=inactive_area, table_status=table_status):
                    area = self.create_area()
                    response = self.client.post('/api/ban', json={
                        'ma_ban': 'DELETE-' + uuid.uuid4().hex,
                        'khu_vuc_id': area['id'], 'suc_chua_toi_thieu': 1,
                        'suc_chua_toi_da': 4, 'loai_ban': 'THUONG', 'trang_thai': table_status,
                    })
                    self.assertEqual(response.status_code, 201)
                    table = response.json()
                    if inactive_area:
                        area = self.client.patch(f'/api/khu-vuc/{area["id"]}/ngung-su-dung').json()
                    deleted = self.client.delete(f'/api/khu-vuc/{area["id"]}')
                    self.assertEqual(deleted.status_code, 409)
                    self.assertEqual(deleted.json()['detail'], 'Khu vực đang có bàn, chỉ có thể ngừng sử dụng.')
                    listed = self.client.get('/api/khu-vuc').json()
                    self.assertEqual(next(row for row in listed if row['id'] == area['id']), area)
                    self.assertEqual(self.client.get(f'/api/ban/{table["id"]}').json(), table)
                    with self.sessions() as db:
                        self.assertIsNotNone(db.get(BanQRToken, table['qr_token']))

    def test_delete_requires_manager(self):
        from app.dependencies.auth import get_current_user
        from app.models.khu_vuc import KhuVuc
        area = self.create_area()
        del self.app.dependency_overrides[get_current_user]
        self.assertEqual(self.client.delete(f'/api/khu-vuc/{area["id"]}').status_code, 401)
        self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(vai_tro='PHUC_VU')
        self.assertEqual(self.client.delete(f'/api/khu-vuc/{area["id"]}').status_code, 403)
        with self.sessions() as db:
            self.assertIsNotNone(db.get(KhuVuc, area['id']))
