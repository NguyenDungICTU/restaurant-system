from datetime import date, datetime

import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from test_assistant import fixture, post  # noqa: F401 - reusable isolated DB fixture
from app.models import DongGoiMon, MonAn
from app.schemas.assistant import ComparisonRange, DataRequest
from app.services.assistant_data import TZ
from app.services.assistant_intents import parse_intent
from app.services.assistant_provider import ModelAnswer
from app.services import assistant_provider as provider
from app.core.config import settings
from pydantic import SecretStr
import json
from app.routers import assistant

TODAY = date(2026, 10, 15)
PERIOD = dict(start="2026-10-15", end="2026-10-15")


def line(**kwargs):
    defaults = dict(dot_goi_mon_id=2, mon_an_id=1, so_luong=1, don_gia=50000,
                    thoi_diem_tiep_nhan=datetime(2026, 10, 15, 10, tzinfo=TZ))
    return DongGoiMon(**(defaults | kwargs))


def test_declining_dishes_include_items_with_no_current_sales_and_use_absolute_drop(fixture):
    with Session(fixture.engine) as db:
        db.add(MonAn(id=2, ten_mon="Bún", nhom_mon_id=1, gia=40000))
        db.flush()
        db.add_all([line(mon_an_id=1, so_luong=10, trang_thai="DA_PHUC_VU", phuc_vu_at=datetime(2026, 10, 14, 12, tzinfo=TZ)),
                    line(mon_an_id=2, so_luong=5, trang_thai="DA_PHUC_VU", phuc_vu_at=datetime(2026, 10, 14, 12, tzinfo=TZ))])
        db.commit()
    data = post(fixture, data_request=dict(kind="dish_trends", **PERIOD)).json()["data"]
    assert data["rows"] == [["Cơm", 10, 2, -8, -80.0], ["Bún", 5, 0, -5, -100.0]]
    assert data["baseline"] == dict(start="2026-10-14", end="2026-10-14")
    assert "nguyên nhân" in data["note"]


def test_decline_with_no_baseline_is_not_a_fake_drop(fixture):
    data = post(fixture, data_request=dict(kind="dish_trends", **PERIOD)).json()["data"]
    assert data["rows"] == []
    assert data["cards"][2]["value"] == 0
    assert data["insights"]


def test_cancellations_use_cancel_time_and_quantity_not_lines(fixture):
    with Session(fixture.engine) as db:
        for item in db.scalars(select(DongGoiMon).where(DongGoiMon.trang_thai == "DA_HUY")):
            item.huy_at = datetime(2026, 10, 13, 12, tzinfo=TZ)
        db.add_all([line(so_luong=4, trang_thai="DA_HUY", huy_at=datetime(2026, 10, 15, 11, tzinfo=TZ)),
                    line(so_luong=2, trang_thai="DA_HUY", huy_at=datetime(2026, 10, 15, 12, tzinfo=TZ))])
        db.commit()
    data = post(fixture, data_request=dict(kind="cancellations", **PERIOD)).json()["data"]
    assert [c["value"] for c in data["cards"]] == [6, 2]
    assert data["rows"] == [["Cơm", 6, 2]]


def test_time_analysis_is_per_line_and_excludes_missing_negative_times(fixture):
    with Session(fixture.engine) as db:
        db.add(MonAn(id=2, ten_mon="Bún", nhom_mon_id=1, gia=40000))
        db.flush()
        db.add_all([
            line(so_luong=10, trang_thai="DA_PHUC_VU", hoan_thanh_at=datetime(2026, 10, 15, 10, 10, tzinfo=TZ), phuc_vu_at=datetime(2026, 10, 15, 10, 15, tzinfo=TZ)),
            line(mon_an_id=2, trang_thai="DA_PHUC_VU", hoan_thanh_at=datetime(2026, 10, 15, 10, 30, tzinfo=TZ), phuc_vu_at=datetime(2026, 10, 15, 11, tzinfo=TZ)),
            line(trang_thai="DA_XONG", hoan_thanh_at=datetime(2026, 10, 15, 9, tzinfo=TZ)),
        ])
        db.commit()
    data = post(fixture, data_request=dict(kind="wait_times", **PERIOD)).json()["data"]
    # Fixture has both a served and a subsequently cancelled row without completion stamps.
    assert [c["value"] for c in data["cards"]] == [20.0, 17.5, 2, 1, 2, 2]
    assert data["rows"][0] == ["Bún", 1, 30.0, 30.0]


def test_missing_timestamps_are_null_not_zero_minutes(fixture):
    data = post(fixture, data_request=dict(kind="wait_times", **PERIOD)).json()["data"]
    assert data["cards"][0]["value"] is None and data["cards"][1]["value"] is None
    assert data["rows"] == []
    assert "Chưa có đủ" in data["summary"]


def test_busy_hours_count_distinct_sessions_per_hour_and_do_not_claim_guest_counts(fixture):
    with Session(fixture.engine) as db:
        for item in db.scalars(select(DongGoiMon)):
            item.thoi_diem_tiep_nhan = datetime(2026, 10, 12, 12, tzinfo=TZ)
        db.add_all([line(dot_goi_mon_id=1, so_luong=2), line(dot_goi_mon_id=1, so_luong=3),
                    line(dot_goi_mon_id=2, so_luong=1), line(dot_goi_mon_id=1, so_luong=4, thoi_diem_tiep_nhan=datetime(2026, 10, 15, 11, tzinfo=TZ))])
        db.commit()
    data = post(fixture, data_request=dict(kind="busy_hours", **PERIOD)).json()["data"]
    assert [c["value"] for c in data["cards"]] == [2, 10]
    assert data["rows"][10] == ["10:00–11:00", 2, 6]
    assert data["rows"][11] == ["11:00–12:00", 1, 4]
    assert len(data["rows"]) == 24 and "không phải số khách" in data["note"]


@pytest.mark.parametrize("role,kind", [("BEP", "dish_trends"), ("PHUC_VU", "cancellations"), ("THU_NGAN", "wait_times"), ("BEP", "busy_hours")])
def test_analysis_permissions_remain_server_side(fixture, role, kind):
    fixture.user.vai_tro = role
    assert post(fixture, data_request=dict(kind=kind, **PERIOD)).status_code == 403


@pytest.mark.parametrize("role", ["QUAN_LY", "PHUC_VU", "BEP"])
def test_allowed_time_analysis_is_read_only_and_does_not_leak_prices(fixture, role):
    fixture.user.vai_tro = role
    statements = []
    event.listen(fixture.engine, "before_cursor_execute", lambda c, u, s, p, ctx, m: statements.append(s.strip().split()[0].upper()))
    response = post(fixture, data_request=dict(kind="wait_times", **PERIOD))
    assert response.status_code == 200
    assert "don_gia" not in response.text and "private-" not in response.text
    assert set(statements) == {"SELECT"}


def test_multi_turn_context_changes_metric_without_losing_dates_or_comparison():
    context = DataRequest(kind="revenue", start="2026-10-12", end="2026-10-15")
    comparison = parse_intent("So với tuần trước?", TODAY, context=context).request
    assert (comparison.start, comparison.end) == (date(2026, 10, 12), date(2026, 10, 15))
    assert comparison.comparison == ComparisonRange(start="2026-10-05", end="2026-10-11")
    trends = parse_intent("Còn món nào giảm mạnh?", TODAY, context=comparison).request
    assert trends.kind == "dish_trends" and trends.comparison == comparison.comparison
    cancel = parse_intent("Món bị hủy nhiều?", TODAY, context=trends).request
    assert cancel.kind == "cancellations" and cancel.start == context.start and cancel.comparison is None
    assert parse_intent("Doanh thu năm trước", TODAY, context=context).clarification


def test_context_can_be_explicitly_cleared_and_cannot_expand_permissions(fixture):
    history = [dict(role="user", content="Doanh thu ngày 15/10/2026")]
    cleared = post(fixture, question="Còn hôm qua?", context=None, history=history).json()
    assert cleared["mode"] == "clarify"
    fixture.user.vai_tro = "BEP"
    unauthorized = post(fixture, question="So với tuần trước?", context=dict(kind="revenue", **PERIOD)).json()
    assert unauthorized["mode"] == "clarify" and not unauthorized["data"]


def test_model_planner_handles_paraphrases_but_only_server_executes_calculations(fixture, monkeypatch):
    monkeypatch.setattr(assistant, "provider_ready", lambda: True)
    def plan(*args):
        assert args[-1].kind == "revenue"
        return ModelAnswer(intent="data", answer="Untrusted numeric text 999999", source_ids=[], kind="dish_trends", start="2026-10-15", end="2026-10-15")
    monkeypatch.setattr(assistant, "ask_model", plan)
    result = post(fixture, question="Mặt hàng nào đang hụt sức tiêu thụ?", context=dict(kind="revenue", **PERIOD)).json()
    assert result["mode"] == "data" and result["data"]["kind"] == "dish_trends"
    assert "999999" not in result["answer"]


@pytest.mark.parametrize("question", ["Thủ đô của Pháp là gì?", "2 cộng 2 bằng mấy?"])
def test_unknown_outside_questions_are_classified_without_returning_model_facts(fixture, monkeypatch, question):
    monkeypatch.setattr(assistant, "provider_ready", lambda: True)
    monkeypatch.setattr(assistant, "ask_model", lambda *a: ModelAnswer(intent="out_of_scope", answer="Paris or 4", source_ids=[], kind="none", start=None, end=None))
    result = post(fixture, question=question).json()
    assert result["mode"] == "scope" and "Paris" not in result["answer"] and not result["data"]


def test_model_cannot_select_financial_data_for_kitchen(fixture, monkeypatch):
    fixture.user.vai_tro = "BEP"
    monkeypatch.setattr(assistant, "provider_ready", lambda: True)
    def malicious(*args):
        assert "revenue" not in [t["kind"] for t in args[4]]
        return ModelAnswer(intent="data", answer="bad", source_ids=[], kind="revenue", start="2026-10-15", end="2026-10-15")
    monkeypatch.setattr(assistant, "ask_model", malicious)
    assert post(fixture, question="Giúp tôi hiểu tình hình quán").json()["mode"] == "scope"


def test_planner_asks_for_dates_instead_of_executing_an_incomplete_plan(fixture, monkeypatch):
    monkeypatch.setattr(assistant, "provider_ready", lambda: True)
    monkeypatch.setattr(assistant, "ask_model", lambda *a: ModelAnswer(intent="data", answer="x", source_ids=[], kind="wait_times", start=None, end=None))
    assert post(fixture, question="Giúp tôi hiểu hiệu quả vận hành").json()["mode"] == "clarify"


def test_provider_sends_filter_context_and_only_allowed_tools_not_business_records(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", SecretStr("dummy-v4-test-only"))
    monkeypatch.setattr(settings, "ai_model", "test-model")
    captured = {}
    class FakeResponse:
        def __enter__(self):
            return self
        def __exit__(self, *a):
            pass
        def read(self, size):
            plan = ModelAnswer(intent="data", answer="Máy chủ sẽ tính dữ liệu.", source_ids=[], kind="wait_times", start="2026-10-15", end="2026-10-15")
            return json.dumps(dict(status="completed", output=[dict(type="message", content=[dict(type="output_text", text=plan.model_dump_json())])])).encode()
    def fake_open(request, timeout):
        captured.update(json.loads(request.data))
        return FakeResponse()
    monkeypatch.setattr(provider, "urlopen", fake_open)
    context = DataRequest(kind="wait_times", **PERIOD)
    result = provider.ask_model("Còn thời gian chờ?", "kitchen", [], [], [dict(kind="wait_times", dated=True)], "2026-10-15", context)
    assert result.kind == "wait_times"
    body = json.loads(captured["input"])
    assert body["filter_context"]["start"] == "2026-10-15"
    assert "dummy-v4-test-only" not in captured["input"] and "rows" not in body
    assert captured["text"]["format"]["schema"]["properties"]["kind"]["enum"] == ["none", "wait_times"]


def test_connection_check_is_explicit_and_does_not_call_provider_without_config(fixture, monkeypatch):
    monkeypatch.setattr(assistant, "provider_ready", lambda: False)
    monkeypatch.setattr(assistant, "ask_model", lambda *a: pytest.fail("No API call without config"))
    result = fixture.client.post("/api/assistant/connection-check").json()
    assert result["connected"] is False and "AI_ENABLED" in result["message"]


@pytest.mark.parametrize("role", ["PHUC_VU", "BEP", "THU_NGAN"])
def test_connection_check_requires_manager(fixture, role):
    fixture.user.vai_tro = role
    assert fixture.client.post("/api/assistant/connection-check").status_code == 403


def test_connection_check_handles_success_and_safe_provider_errors(fixture, monkeypatch):
    monkeypatch.setattr(assistant, "provider_ready", lambda: True)
    monkeypatch.setattr(assistant, "ask_model", lambda *a: ModelAnswer(intent="guide", answer="Hướng dẫn.", source_ids=["overview"], kind="none", start=None, end=None))
    assert fixture.client.post("/api/assistant/connection-check").json()["connected"] is True
    def fail(*args):
        raise provider.ProviderUnavailable("Never expose raw provider details")
    monkeypatch.setattr(assistant, "ask_model", fail)
    response = fixture.client.post("/api/assistant/connection-check")
    assert response.json()["connected"] is False and "raw provider" not in response.text


def test_clarification_keeps_pending_metric_for_a_short_date_answer(fixture):
    missing = post(fixture, question="Thời gian xử lý món?", context=None).json()
    assert missing["mode"] == "clarify"
    assert missing["context_update"]["kind"] == "wait_times"
    answer = post(fixture, question="Hôm nay", context=missing["context_update"]).json()
    assert answer["mode"] == "data" and answer["data"]["kind"] == "wait_times"


def test_model_clarification_can_keep_only_a_permitted_pending_metric(fixture, monkeypatch):
    monkeypatch.setattr(assistant, "provider_ready", lambda: True)
    monkeypatch.setattr(assistant, "ask_model", lambda *a: ModelAnswer(intent="clarify", answer="Bạn muốn xem ngày nào?", source_ids=[], kind="wait_times", start=None, end=None))
    result = post(fixture, question="Giúp tôi hiểu tốc độ phục vụ món").json()
    assert result["context_update"]["kind"] == "wait_times"
