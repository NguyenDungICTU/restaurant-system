import json
import select
from collections.abc import Generator
from typing import Any

import psycopg2
from sqlalchemy import event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ban import Ban
from app.models.dat_ban import DatBan


EVENT_CHANNEL = "restaurant_table_map_events"
_TRACKED_TABLE_FIELDS = (
    "trang_thai",
    "da_cau_hinh",
    "khu_vuc_id",
    "suc_chua_toi_thieu",
    "suc_chua_toi_da",
    "loai_ban",
)
_TRACKED_BOOKING_FIELDS = (
    "ban_id",
    "trang_thai",
    "khach_toi_at",
    "ngay_dat",
    "gio_bat_dau",
    "thoi_luong_giu_ban",
    "so_luong_khach",
    "ho_ten_khach",
)
_PENDING_KEY = "_table_map_pending_events"


def _changed(instance: Any, fields: tuple[str, ...]) -> bool:
    state = inspect(instance)
    return any(state.attrs[name].history.has_changes() for name in fields)


def _remember(session: Session, kind: str, instance: Any) -> None:
    pending = session.info.setdefault(_PENDING_KEY, {})
    key = (kind, id(instance))
    previous = pending.get(key)
    previous_ids = (
        previous[1]
        if kind == "booking" and previous is not None
        else set()
    )
    if kind == "booking":
        previous_ids = set(previous_ids)
        previous_ids.update(
            value
            for value in inspect(instance).attrs.ban_id.history.deleted
            if value is not None
        )
    pending[key] = (instance, previous_ids)


@event.listens_for(Session, "before_flush")
def collect_table_map_changes(
    session: Session,
    flush_context: Any,
    instances: Any,
) -> None:
    for instance in session.new:
        if isinstance(instance, Ban):
            _remember(session, "table", instance)
        elif isinstance(instance, DatBan):
            _remember(session, "booking", instance)

    for instance in session.dirty:
        if isinstance(instance, Ban) and _changed(
            instance,
            _TRACKED_TABLE_FIELDS,
        ):
            _remember(session, "table", instance)
        elif isinstance(instance, DatBan) and _changed(
            instance,
            _TRACKED_BOOKING_FIELDS,
        ):
            _remember(session, "booking", instance)


def _table_event(table: Ban) -> dict[str, Any]:
    return {
        "type": "table_changed",
        "table": {
            "id": table.id,
            "ma_ban": table.ma_ban,
            "khu_vuc_id": table.khu_vuc_id,
            "trang_thai": table.trang_thai,
            "da_cau_hinh": table.da_cau_hinh,
            "suc_chua_toi_thieu": table.suc_chua_toi_thieu,
            "suc_chua_toi_da": table.suc_chua_toi_da,
            "loai_ban": table.loai_ban,
        },
    }


def _booking_event(
    booking: DatBan,
    previous_table_ids: set[int],
) -> dict[str, Any]:
    table_ids = {booking.ban_id} if booking.ban_id is not None else set()
    table_ids.update(previous_table_ids)
    return {
        "type": "bookings_changed",
        "table_ids": sorted(table_ids),
    }


@event.listens_for(Session, "after_flush_postexec")
def publish_table_map_changes(
    session: Session,
    flush_context: Any,
) -> None:
    pending = session.info.pop(_PENDING_KEY, {})
    if not pending or session.get_bind().dialect.name != "postgresql":
        return

    connection = session.connection()
    for (kind, _), (instance, previous_table_ids) in pending.items():
        payload = (
            _table_event(instance)
            if kind == "table"
            else _booking_event(instance, previous_table_ids)
        )
        connection.execute(
            text("SELECT pg_notify(:channel, :payload)"),
            {
                "channel": EVENT_CHANNEL,
                "payload": json.dumps(
                    payload,
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
            },
        )


@event.listens_for(Session, "after_rollback")
def discard_table_map_changes(session: Session) -> None:
    session.info.pop(_PENDING_KEY, None)


@event.listens_for(Session, "after_commit")
def clear_table_map_changes(session: Session) -> None:
    session.info.pop(_PENDING_KEY, None)


def _sse(event_name: str, data: dict[str, Any]) -> str:
    return (
        f"event: {event_name}\n"
        f"data: {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}\n\n"
    )


def stream_table_map_events(
    token_hash: str,
    employee_id: int,
) -> Generator[str, None, None]:
    database_url = make_url(settings.database_url)
    if database_url.get_backend_name() != "postgresql":
        raise RuntimeError(
            "Table map events require PostgreSQL LISTEN/NOTIFY."
        )

    dsn = database_url.set(drivername="postgresql").render_as_string(
        hide_password=False
    )
    connection = psycopg2.connect(dsn)
    cursor = connection.cursor()

    try:
        cursor.execute(f"LISTEN {EVENT_CHANNEL}")
        connection.commit()
        yield _sse("ready", {})

        while True:
            readable, _, _ = select.select([connection], [], [], 15)
            if readable:
                connection.poll()
                notifications = list(connection.notifies)
                connection.notifies.clear()
                for notification in notifications:
                    yield _sse("update", json.loads(notification.payload))
                continue

            cursor.execute(
                """
                SELECT employee.vai_tro
                FROM phien_dang_nhap AS session
                JOIN nhan_vien AS employee
                  ON employee.id = session.nhan_vien_id
                WHERE session.token_hash = %s
                  AND session.nhan_vien_id = %s
                  AND session.revoked_at IS NULL
                  AND session.expires_at > CURRENT_TIMESTAMP
                  AND employee.trang_thai = 'HOAT_DONG'
                """,
                (token_hash, employee_id),
            )
            auth_state = cursor.fetchone()
            if auth_state is None:
                yield _sse("auth-expired", {})
                return
            if auth_state[0] not in {"QUAN_LY", "PHUC_VU"}:
                yield _sse("forbidden", {})
                return
            connection.commit()
            yield ": keep-alive\n\n"
    finally:
        cursor.close()
        connection.close()
