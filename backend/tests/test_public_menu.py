"""Public menu contract tests using the project's disposable PostgreSQL setup."""
import os
import subprocess
import unittest
import uuid
from sqlalchemy.engine import make_url
import psycopg2
from psycopg2 import sql


class PublicMenuIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_database_url = os.environ["DATABASE_URL"]
        source = make_url(os.environ["DATABASE_URL"])
        cls.database_name = "test_public_menu_" + uuid.uuid4().hex
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
        from app.models.nhom_mon import NhomMon
        from app.models.mon_an import MonAn
        cls.app, cls.client, cls.sessions, cls.engine = app, TestClient(app), SessionLocal, engine
        with SessionLocal() as db:
            category = NhomMon(ten_nhom="Món chính", thu_tu=1, dang_su_dung=True)
            db.add(category)
            db.flush()
            db.add_all([
                MonAn(ten_mon="Cơm rang", nhom_mon_id=category.id, gia=45000, trang_thai="DANG_BAN"),
                MonAn(ten_mon="Lẩu thái", nhom_mon_id=category.id, gia=250000, trang_thai="TAM_HET"),
                MonAn(ten_mon="Món ẩn", nhom_mon_id=category.id, gia=10000, trang_thai="NGUNG_BAN"),
            ])
            db.commit()

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

    def test_public_menu_requires_no_auth_and_keeps_tam_het(self):
        response = self.client.get("/api/menu/public")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        dishes = payload["categories"][0]["mon_an"]
        names = {dish["ten_mon"]: dish for dish in dishes}
        self.assertIn("Cơm rang", names)
        self.assertIn("Lẩu thái", names)
        self.assertNotIn("Món ẩn", names)
        self.assertEqual(names["Lẩu thái"]["trang_thai"], "TAM_HET")
