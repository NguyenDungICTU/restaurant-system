"""Verify the complete Alembic chain against disposable PostgreSQL databases."""
import os
import subprocess
import unittest
import uuid

import psycopg2
from psycopg2 import sql
from sqlalchemy.engine import make_url


class MigrationTests(unittest.TestCase):
    HEAD = "019_booking_timeout"

    EXPECTED_TABLES = {
        "alembic_version",
        "nhan_vien",
        "phien_dang_nhap",
        "nhat_ky_thao_tac",
        "nhom_mon",
        "mon_an",
        "khu_vuc",
        "ban",
        "ban_qr_token",
        "dat_ban",
        "lich_hoat_dong",
        "ngay_nghi_dac_biet",
        "cau_hinh_dat_ban",
        "thong_bao",
        "phien_ban",
        "dot_goi_mon",
        "dong_goi_mon",
        "ca_lam_viec",
        "hoa_don",
    }

    def setUp(self):
        source = make_url(os.environ["DATABASE_URL"])
        self.name = "test_migrations_" + uuid.uuid4().hex
        self.admin = psycopg2.connect(
            source.set(drivername="postgresql").render_as_string(hide_password=False)
        )
        self.admin.autocommit = True
        with self.admin.cursor() as cursor:
            cursor.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(self.name))
            )

        self.addCleanup(self.drop_database)
        url = source.set(database=self.name)
        self.env = {
            **os.environ,
            "DATABASE_URL": url.render_as_string(hide_password=False),
        }
        self.db = psycopg2.connect(
            url.set(drivername="postgresql").render_as_string(hide_password=False)
        )
        self.db.autocommit = True

    def drop_database(self):
        if hasattr(self, "db"):
            self.db.close()
        with self.admin.cursor() as cursor:
            cursor.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(
                    sql.Identifier(self.name)
                )
            )
        self.admin.close()

    def migrate(self, direction, revision):
        subprocess.run(
            ["alembic", direction, revision],
            env=self.env,
            check=True,
        )

    def query(self, statement, parameters=()):
        with self.db.cursor() as cursor:
            cursor.execute(statement, parameters)
            return cursor.fetchall() if cursor.description else None

    def tables(self):
        return {
            row[0]
            for row in self.query(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = 'public'"
            )
        }

    def area_snapshot(self):
        return {
            "data": self.query("SELECT * FROM khu_vuc ORDER BY id"),
            "columns": self.query(
                "SELECT column_name, data_type, is_nullable, column_default "
                "FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='khu_vuc' "
                "ORDER BY ordinal_position"
            ),
            "indexes": self.query(
                "SELECT indexname, indexdef FROM pg_indexes "
                "WHERE schemaname='public' AND tablename='khu_vuc' "
                "ORDER BY indexname"
            ),
            "constraints": self.query(
                "SELECT conname, pg_get_constraintdef(oid) "
                "FROM pg_constraint "
                "WHERE conrelid='khu_vuc'::regclass "
                "ORDER BY conname"
            ),
        }

    def test_empty_database_to_head(self):
        self.assertEqual(self.tables(), set())

        self.migrate("upgrade", "head")

        self.assertEqual(
            self.query("SELECT version_num FROM alembic_version"),
            [(self.HEAD,)],
        )
        self.assertEqual(self.tables(), self.EXPECTED_TABLES)

        # Running upgrade head again must be idempotent.
        self.migrate("upgrade", "head")
        self.assertEqual(
            self.query("SELECT version_num FROM alembic_version"),
            [(self.HEAD,)],
        )

    def test_khu_vuc_data_survives_full_chain_and_downgrade(self):
        self.migrate("upgrade", "002_add_menu_categories")
        # 004 creates khu_vuc, so move to that revision before inserting data.
        self.migrate("upgrade", "004_add_khu_vuc")
        self.query(
            "INSERT INTO khu_vuc (ten_khu_vuc, thu_tu_hien_thi, ghi_chu) "
            "VALUES ('Tầng 1', 7, 'Giữ nguyên')"
        )
        before = self.area_snapshot()

        self.migrate("upgrade", "head")
        self.assertEqual(self.area_snapshot(), before)

        with self.assertRaises(psycopg2.errors.UniqueViolation):
            self.query("INSERT INTO khu_vuc (ten_khu_vuc) VALUES (' Tầng 1 ')")

        area_id = before["data"][0][0]
        table_id = self.query(
            "INSERT INTO ban "
            "(ma_ban, khu_vuc_id, suc_chua_toi_thieu, suc_chua_toi_da, "
            "loai_ban, qr_token) "
            "VALUES ('B1', %s, 1, 4, 'THUONG', 'migration-test-token') "
            "RETURNING id",
            (area_id,),
        )[0][0]
        self.query(
            "INSERT INTO ban_qr_token (token, ban_id) "
            "VALUES ('migration-test-token', %s)",
            (table_id,),
        )

        with self.assertRaises(psycopg2.errors.ForeignKeyViolation):
            self.query("DELETE FROM khu_vuc WHERE id=%s", (area_id,))

        with self.assertRaises(psycopg2.errors.CheckViolation):
            self.query(
                "UPDATE ban SET suc_chua_toi_da=0 WHERE id=%s",
                (table_id,),
            )

        self.migrate("downgrade", "004_add_khu_vuc")
        self.assertEqual(self.area_snapshot(), before)
        self.assertNotIn("ban", self.tables())
        self.assertNotIn("ban_qr_token", self.tables())

        self.migrate("upgrade", "head")
        self.assertEqual(self.area_snapshot(), before)
        self.assertEqual(
            self.query("SELECT version_num FROM alembic_version"),
            [(self.HEAD,)],
        )

    def test_new_core_tables_have_expected_relationships(self):
        self.migrate("upgrade", "head")

        checks = {
            "phien_ban": ["ban_id", "trang_thai"],
            "dot_goi_mon": ["phien_ban_id", "so_dot"],
            "dong_goi_mon": ["dot_goi_mon_id", "mon_an_id", "don_gia", "ghi_chu"],
            "ca_lam_viec": ["nhan_vien_id", "trang_thai", "chenh_lech"],
            "hoa_don": ["phien_ban_id", "ca_lam_viec_id", "so_hoa_don", "tong_thanh_toan"],
            "thong_bao": ["dat_ban_id", "loai", "trang_thai", "so_lan_thu"],
        }

        for table, columns in checks.items():
            actual = {
                row[0]
                for row in self.query(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=%s",
                    (table,),
                )
            }
            self.assertTrue(
                set(columns).issubset(actual),
                msg=f"Missing columns in {table}: {set(columns) - actual}",
            )

        ban_columns = {
            row[0]
            for row in self.query(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='ban'"
            )
        }
        self.assertIn("da_cau_hinh", ban_columns)

    def test_existing_table_data_remains_configured_by_default(self):
        self.migrate("upgrade", "017_shift_and_table_merge")
        self.query(
            "INSERT INTO khu_vuc (ten_khu_vuc) VALUES ('Tầng cũ')"
        )
        area_id = self.query(
            "SELECT id FROM khu_vuc WHERE ten_khu_vuc='Tầng cũ'"
        )[0][0]
        self.query(
            "INSERT INTO ban "
            "(ma_ban, khu_vuc_id, suc_chua_toi_thieu, suc_chua_toi_da, "
            "loai_ban, trang_thai, qr_token) "
            "VALUES ('M-CU', %s, 2, 6, 'PHONG_RIENG', 'DA_DAT', 'qr-cu')",
            (area_id,),
        )
        before = self.query(
            "SELECT ma_ban, suc_chua_toi_thieu, suc_chua_toi_da, "
            "loai_ban, trang_thai, qr_token "
            "FROM ban WHERE ma_ban='M-CU'"
        )

        self.migrate("upgrade", "head")

        after = self.query(
            "SELECT ma_ban, suc_chua_toi_thieu, suc_chua_toi_da, "
            "loai_ban, trang_thai, qr_token, da_cau_hinh "
            "FROM ban WHERE ma_ban='M-CU'"
        )
        self.assertEqual(after[0][:-1], before[0])
        self.assertIs(after[0][-1], True)
