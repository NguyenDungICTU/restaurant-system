from datetime import date

import pytest

from app.schemas.assistant import HistoryMessage
from app.services.assistant_intents import date_range, parse_intent

TODAY = date(2026, 10, 15)


@pytest.mark.parametrize("question,kind,start,end", [
    ("Doanh thu hôm nay bao nhiêu?", "revenue", date(2026, 10, 15), date(2026, 10, 15)),
    ("doanh thu hom qua", "revenue", date(2026, 10, 14), date(2026, 10, 14)),
    ("Món bán chạy 7 ngày qua", "dishes", date(2026, 10, 9), date(2026, 10, 15)),
    ("Doanh thu tuần này", "revenue", date(2026, 10, 12), date(2026, 10, 15)),
    ("Doanh thu tháng này", "revenue", date(2026, 10, 1), date(2026, 10, 15)),
    ("Doanh thu tháng trước", "revenue", date(2026, 9, 1), date(2026, 9, 30)),
    ("Doanh thu từ 01/10/2026 đến 15/10/2026", "revenue", date(2026, 10, 1), date(2026, 10, 15)),
    ("Doanh thu ngày 2026-10-14", "revenue", date(2026, 10, 14), date(2026, 10, 14)),
    ("Doanh thu tháng 02/2024", "revenue", date(2024, 2, 1), date(2024, 2, 29)),
])
def test_supported_date_intents(question, kind, start, end):
    result = parse_intent(question, TODAY)
    assert result.request.kind == kind
    assert (result.request.start, result.request.end) == (start, end)


@pytest.mark.parametrize("question,kind", [
    ("Bàn nào còn trống?", "tables"), ("Có bao nhiêu món chờ mang ra?", "orders"),
    ("Bàn nào đang chờ thanh toán?", "checkouts"), ("Doanh thu ca của tôi", "shift"),
    ("Có bao nhiêu món đang chế biến?", "orders"), ("Món nào đã xong?", "orders"),
])
def test_current_queries_need_no_date(question, kind):
    result = parse_intent(question, TODAY)
    assert result.request.kind == kind
    assert result.request.start is None


@pytest.mark.parametrize("question", ["Doanh thu bao nhiêu?", "Doanh thu quý trước", "Doanh thu ngày 15/10", "Doanh thu ngày 31/02/2026", "Doanh thu 99999 ngày qua", "Doanh thu hôm nay và hôm qua", "Doanh thu từ 1 đến 15/10/2026"])
def test_unclear_dates_are_not_silently_changed_to_today(question):
    result = parse_intent(question, TODAY)
    assert result.clarification and result.request is None


def test_month_week_year_boundaries_and_leap_day():
    assert date_range("thang truoc", date(2026, 1, 3)) == (date(2025, 12, 1), date(2025, 12, 31))
    assert date_range("tuan truoc", date(2026, 1, 1)) == (date(2025, 12, 22), date(2025, 12, 28))
    assert date_range("hom qua", date(2024, 3, 1)) == (date(2024, 2, 29), date(2024, 2, 29))


def test_explicit_and_automatic_revenue_comparisons():
    result = parse_intent("So sánh doanh thu hôm nay với hôm qua", TODAY).request
    assert result.start == TODAY and result.comparison.start == date(2026, 10, 14)
    automatic = parse_intent("So sánh doanh thu 7 ngày qua với kỳ trước", TODAY).request
    assert automatic.compare_previous and automatic.comparison is None


def test_followup_uses_latest_user_topic_but_not_assistant_claims():
    history = [HistoryMessage(role="user", content="Doanh thu hôm nay"), HistoryMessage(role="assistant", content="Đây là hóa đơn")]
    request = parse_intent("Còn hôm qua?", TODAY, history).request
    assert request.kind == "revenue" and request.start == date(2026, 10, 14)
    assert parse_intent("Thời tiết hôm qua?", TODAY, history).request is None
    assert parse_intent("Còn hôm qua?", TODAY, [HistoryMessage(role="assistant", content="Doanh thu hôm nay")]).request is None


@pytest.mark.parametrize("question", ["Cách xem doanh thu?", "Hướng dẫn gọi món", "Cho tôi xem thời tiết hôm nay", "nay đề về bao nhiêu", "Viết thơ về doanh thu nhà hàng"])
def test_guidance_and_outside_topics_never_trigger_data_queries(question):
    assert parse_intent(question, TODAY).request is None


def test_unsupported_historical_or_comparative_queries_ask_for_clarification():
    assert parse_intent("Trạng thái bàn hôm qua", TODAY).clarification
    assert parse_intent("So sánh món bán chạy hôm nay với hôm qua", TODAY).clarification


def test_top_limit_is_respected_or_explicitly_rejected():
    assert parse_intent("Top 5 món hôm nay", TODAY).request.limit == 5
    assert parse_intent("Top 100 món hôm nay", TODAY).clarification
