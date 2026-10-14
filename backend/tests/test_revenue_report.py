from datetime import date, datetime, time
from decimal import Decimal
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from app.services.revenue_report import (
    build_hourly_revenue,
    summarize_invoices,
    validate_report_range,
)

TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def test_report_range_allows_92_inclusive_days():
    assert validate_report_range(date(2026, 1, 1), date(2026, 4, 2)) == 92


def test_report_range_rejects_more_than_92_days():
    with pytest.raises(ValueError, match="92 ngày"):
        validate_report_range(date(2026, 1, 1), date(2026, 4, 3))


def test_report_range_rejects_reversed_dates():
    with pytest.raises(ValueError, match="Ngày kết thúc"):
        validate_report_range(date(2026, 1, 2), date(2026, 1, 1))


def test_summary_ignores_cancelled_invoices_and_handles_no_data():
    invoices = [
        SimpleNamespace(trang_thai="DA_CHOT", tong_thanh_toan=Decimal("100000")),
        SimpleNamespace(trang_thai="DA_CHOT", tong_thanh_toan=Decimal("50000")),
        SimpleNamespace(trang_thai="DA_HUY", tong_thanh_toan=Decimal("999999")),
    ]
    assert summarize_invoices(invoices) == {
        "revenue": 150000,
        "invoice_count": 2,
        "average_invoice": 75000,
        "has_transactions": True,
    }
    assert summarize_invoices([]) == {
        "revenue": 0, "invoice_count": 0, "average_invoice": 0,
        "has_transactions": False,
    }


def test_hourly_report_includes_opening_hours_and_aggregates_per_hour():
    invoices = [
        SimpleNamespace(chot_at=datetime(2026, 10, 12, 10, 10, tzinfo=TZ), tong_thanh_toan=Decimal("100000")),
        SimpleNamespace(chot_at=datetime(2026, 10, 12, 10, 45, tzinfo=TZ), tong_thanh_toan=Decimal("50000")),
        SimpleNamespace(chot_at=datetime(2026, 10, 12, 13, 0, tzinfo=TZ), tong_thanh_toan=Decimal("90000")),
    ]
    hours = build_hourly_revenue(
        invoices, date(2026, 10, 12), date(2026, 10, 12), TZ,
        [(0, time(9, 0), time(12, 0))],
    )
    assert hours == [
        {"hour": 9, "label": "09:00–10:00", "revenue": 0},
        {"hour": 10, "label": "10:00–11:00", "revenue": 150000},
        {"hour": 11, "label": "11:00–12:00", "revenue": 0},
    ]
