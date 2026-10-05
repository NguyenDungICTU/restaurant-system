import json
import os
import select
import time
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.dependencies.auth import get_request_session_token
from app.models.ban import Ban
from app.models.khu_vuc import KhuVuc
from app.routers.table_map_events import (
    get_table_events_user,
    router,
)
from app.services.table_map_events import (
    EVENT_CHANNEL,
    _table_event,
)


class TableMapEventTests(unittest.TestCase):
    def test_table_event_contains_snapshot_fields(self):
        table = Ban(
            id=42,
            ma_ban="KV1-001",
            khu_vuc_id=1,
            trang_thai="DANG_SU_DUNG",
            da_cau_hinh=True,
            suc_chua_toi_thieu=2,
            suc_chua_toi_da=6,
            loai_ban="PHONG_RIENG",
            qr_token="test-only",
        )

        payload = _table_event(table)

        self.assertEqual(
            payload,
            {
                "type": "table_changed",
                "table": {
                    "id": 42,
                    "ma_ban": "KV1-001",
                    "khu_vuc_id": 1,
                    "trang_thai": "DANG_SU_DUNG",
                    "da_cau_hinh": True,
                    "suc_chua_toi_thieu": 2,
                    "suc_chua_toi_da": 6,
                    "loai_ban": "PHONG_RIENG",
                },
            },
        )
        json.dumps(payload)

    def test_event_endpoint_authenticates_role_and_session(self):
        api = FastAPI()
        api.include_router(router)
        api.dependency_overrides[get_request_session_token] = (
            lambda: "test-session-token"
        )
        api.dependency_overrides[get_table_events_user] = lambda: (
            SimpleNamespace(id=1, vai_tro="BEP")
        )

        with patch(
            "app.routers.table_map_events.settings.database_url",
            "sqlite:///table-map-test.db",
        ):
            with TestClient(api) as client:
                api.dependency_overrides[get_table_events_user] = lambda: (
                    SimpleNamespace(id=1, vai_tro="PHUC_VU")
                )
                api.dependency_overrides[
                    get_request_session_token
                ] = lambda: None
                response = client.get("/api/ban/events")
                self.assertEqual(response.status_code, 401)

                api.dependency_overrides[
                    get_request_session_token
                ] = lambda: "test-session-token"
                response = client.get("/api/ban/events")
                self.assertEqual(response.status_code, 503)

        with patch(
            "app.routers.table_map_events.get_current_user",
            return_value=SimpleNamespace(
                id=1,
                vai_tro="BEP",
            ),
        ):
            with self.assertRaises(HTTPException) as forbidden:
                get_table_events_user(
                    request=SimpleNamespace(),
                    session_token="test-session-token",
                    db=SimpleNamespace(),
                )
        self.assertEqual(forbidden.exception.status_code, 403)

    @unittest.skipUnless(
        os.getenv("TABLE_MAP_TEST_DATABASE_URL"),
        "Set TABLE_MAP_TEST_DATABASE_URL to a disposable migrated PostgreSQL database.",
    )
    def test_postgres_notify_is_commit_scoped_and_cross_connection(self):
        database_url = make_url(
            os.environ["TABLE_MAP_TEST_DATABASE_URL"]
        )
        self.assertEqual(database_url.get_backend_name(), "postgresql")
        self.assertTrue(
            (database_url.database or "").endswith("_test"),
            "Refusing to run against a database without the _test suffix.",
        )

        dsn = database_url.set(drivername="postgresql").render_as_string(
            hide_password=False
        )
        listener = psycopg2.connect(dsn)
        listen_cursor = listener.cursor()
        listen_cursor.execute(f"LISTEN {EVENT_CHANNEL}")
        listener.commit()

        engine_url = database_url.set(drivername="postgresql+psycopg2")
        engine = create_engine(engine_url)
        test_sessions = sessionmaker(
            bind=engine,
            expire_on_commit=False,
        )
        db = test_sessions()
        area = KhuVuc(
            ten_khu_vuc=f"Table event test {uuid.uuid4().hex}"
        )
        area_id = None
        table_id = None

        def receive_table_event(table_id, timeout):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                remaining = max(0, deadline - time.monotonic())
                readable, _, _ = select.select(
                    [listener],
                    [],
                    [],
                    remaining,
                )
                if not readable:
                    break
                listener.poll()
                notifications = list(listener.notifies)
                listener.notifies.clear()
                for notification in notifications:
                    payload = json.loads(notification.payload)
                    if (
                        payload.get("type") == "table_changed"
                        and payload["table"]["id"] == table_id
                    ):
                        return payload
            return None

        try:
            db.add(area)
            db.flush()
            area_id = area.id
            table = Ban(
                ma_ban=f"EV-{uuid.uuid4().hex[:12]}",
                khu_vuc_id=area_id,
                suc_chua_toi_thieu=1,
                suc_chua_toi_da=4,
                loai_ban="THUONG",
                da_cau_hinh=True,
                trang_thai="TRONG",
                qr_token=uuid.uuid4().hex,
            )
            db.add(table)
            db.commit()
            table_id = table.id
            self.assertIsNotNone(receive_table_event(table_id, timeout=2))

            table.trang_thai = "DANG_DON"
            db.flush()
            db.rollback()
            self.assertIsNone(
                receive_table_event(table_id, timeout=0.25)
            )

            table = db.get(Ban, table_id)
            table.trang_thai = "DA_DAT"
            db.commit()
            committed_at = time.monotonic()
            event_payload = receive_table_event(
                table_id,
                timeout=5,
            )
            delivered_after = time.monotonic() - committed_at

            self.assertIsNotNone(event_payload)
            self.assertEqual(
                event_payload["table"]["trang_thai"],
                "DA_DAT",
            )
            self.assertLessEqual(delivered_after, 5)
        finally:
            db.rollback()
            if table_id is not None:
                table = db.get(Ban, table_id)
                if table is not None:
                    db.delete(table)
            area = db.get(KhuVuc, area_id) if area_id is not None else None
            if area is not None:
                db.delete(area)
            db.commit()
            db.close()
            engine.dispose()
            listen_cursor.close()
            listener.close()
