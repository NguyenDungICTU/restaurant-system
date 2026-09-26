"""Verify S1-07 migrations only against disposable PostgreSQL databases."""
import os
import subprocess
import unittest
import uuid

import psycopg2
from psycopg2 import sql
from sqlalchemy.engine import make_url


class MigrationTests(unittest.TestCase):
    def setUp(self):
        source = make_url(os.environ['DATABASE_URL'])
        self.name = 'test_s107_migration_' + uuid.uuid4().hex
        self.admin = psycopg2.connect(source.set(drivername='postgresql').render_as_string(hide_password=False))
        self.admin.autocommit = True
        with self.admin.cursor() as cursor:
            cursor.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(self.name)))
        self.addCleanup(self.drop_database)
        url = source.set(database=self.name)
        self.env = {**os.environ, 'DATABASE_URL': url.render_as_string(hide_password=False)}
        self.db = psycopg2.connect(url.set(drivername='postgresql').render_as_string(hide_password=False))
        self.db.autocommit = True

    def drop_database(self):
        if hasattr(self, 'db'):
            self.db.close()
        with self.admin.cursor() as cursor:
            cursor.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(self.name)))
        self.admin.close()

    def migrate(self, direction, revision):
        subprocess.run(['alembic', direction, revision], env=self.env, check=True)

    def query(self, statement, parameters=()):
        with self.db.cursor() as cursor:
            cursor.execute(statement, parameters)
            return cursor.fetchall() if cursor.description else None

    def tables(self):
        return {row[0] for row in self.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")}

    def area_snapshot(self):
        return {
            'data': self.query('SELECT * FROM khu_vuc ORDER BY id'),
            'columns': self.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='khu_vuc' ORDER BY ordinal_position"),
            'indexes': self.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='khu_vuc' ORDER BY indexname"),
            'constraints': self.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='khu_vuc'::regclass ORDER BY conname"),
        }

    def test_empty_database_to_head(self):
        self.assertEqual(self.tables(), set())
        self.migrate('upgrade', 'head')
        self.assertEqual(self.query('SELECT version_num FROM alembic_version'), [('003_add_ban',)])
        self.assertEqual(self.tables(), {'alembic_version', 'nhan_vien', 'phien_dang_nhap', 'nhat_ky_thao_tac', 'khu_vuc', 'ban', 'ban_qr_token'})
        self.migrate('upgrade', 'head')  # Startup may run migration repeatedly.
        self.assertEqual(self.query('SELECT version_num FROM alembic_version'), [('003_add_ban',)])

    def test_002_data_schema_and_unique_index_survive_003(self):
        self.migrate('upgrade', '002_add_khu_vuc')
        self.query("INSERT INTO khu_vuc (ten_khu_vuc, thu_tu_hien_thi, ghi_chu) VALUES ('Tầng 1', 7, 'Giữ nguyên')")
        before = self.area_snapshot()
        self.migrate('upgrade', 'head')
        self.assertEqual(self.area_snapshot(), before)
        with self.assertRaises(psycopg2.errors.UniqueViolation):
            self.query("INSERT INTO khu_vuc (ten_khu_vuc) VALUES (' Tầng 1 ')")
        area_id = before['data'][0][0]
        table_id = self.query("INSERT INTO ban (ma_ban, khu_vuc_id, suc_chua_toi_thieu, suc_chua_toi_da, loai_ban, qr_token) VALUES ('B1', %s, 1, 4, 'THUONG', 'migration-test-token') RETURNING id", (area_id,))[0][0]
        self.query("INSERT INTO ban_qr_token (token, ban_id) VALUES ('migration-test-token', %s)", (table_id,))
        with self.assertRaises(psycopg2.errors.ForeignKeyViolation):
            self.query('DELETE FROM khu_vuc WHERE id=%s', (area_id,))
        with self.assertRaises(psycopg2.errors.CheckViolation):
            self.query('UPDATE ban SET suc_chua_toi_da=0 WHERE id=%s', (table_id,))
        self.migrate('downgrade', '002_add_khu_vuc')
        self.assertEqual(self.area_snapshot(), before)
        self.assertNotIn('ban', self.tables())
        self.assertNotIn('ban_qr_token', self.tables())
        self.migrate('upgrade', 'head')
        self.assertEqual(self.area_snapshot(), before)
