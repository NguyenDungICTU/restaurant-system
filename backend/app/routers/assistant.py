"""Authenticated helper. No write tools, arbitrary URLs, selectors or SQL."""
from collections import defaultdict, deque
from datetime import datetime
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.models.nhan_vien import NhanVien
from app.schemas.assistant import ChatRequest, ComparisonRange, DataRequest
from app.services.assistant_data import TZ, allowed_tools, read_data
from app.services.assistant_knowledge import KNOWLEDGE_VERSION, PAGES, allowed_guides, followup_question, has_phrase, outside_topic, retrieve
from app.services.assistant_provider import ProviderUnavailable, ask_model, provider_ready
from app.services.assistant_intents import EXAMPLES, parse_intent

router = APIRouter(prefix="/api/assistant", tags=["Trợ lý"])


class UserRateLimit:
    """Single-process limit. Use a shared limiter when deploying multiple workers."""
    def __init__(self):
        self.events = defaultdict(deque)
        self.lock = Lock()

    def check(self, user_id, limit, now=None):
        now = monotonic() if now is None else now
        with self.lock:
            for key in list(self.events):
                while self.events[key] and self.events[key][0] <= now - 60:
                    self.events[key].popleft()
                if not self.events[key]:
                    del self.events[key]
            if len(self.events) >= 5000 and user_id not in self.events:
                raise HTTPException(429, "Trợ lý đang bận, vui lòng thử lại sau.", headers={"Retry-After": "60"})
            if len(self.events[user_id]) >= limit:
                raise HTTPException(429, "Bạn hỏi quá nhanh. Vui lòng thử lại sau một phút.", headers={"Retry-After": "60"})
            self.events[user_id].append(now)


limiter = UserRateLimit()


def public_guide(item):
    return {key: item[key] for key in ("id", "title", "page", "steps")}


def validate_role(role):
    if role not in PAGES:
        raise HTTPException(403, "Vai trò này chưa được hỗ trợ bởi trợ lý.")


def text_reply(mode, answer, suggestions=None, context_update=None):
    result = dict(mode=mode, answer=answer, notice="", sources=[], data=None,
                  suggestions=suggestions or [], version=KNOWLEDGE_VERSION)
    if context_update:
        result["context_update"] = context_update.model_dump(mode="json")
    return result


SCOPE_MESSAGE = ("Tôi chỉ hỗ trợ sử dụng hệ thống quản lý nhà hàng Resto trong phạm vi quyền của bạn. "
                 "Hãy hỏi rõ chức năng hoặc chọn một mục trong tab Hướng dẫn.")


@router.get("/catalog")
def catalog(response: Response, user: NhanVien = Depends(get_current_user)):
    validate_role(user.vai_tro)
    response.headers["Cache-Control"] = "no-store"
    return dict(version=KNOWLEDGE_VERSION, ai_ready=provider_ready(),
                can_check_ai=user.vai_tro == "QUAN_LY",
                guides=[public_guide(g) for g in allowed_guides(user.vai_tro)],
                tools=allowed_tools(user.vai_tro), query_examples=EXAMPLES[user.vai_tro])


@router.post("/connection-check")
def connection_check(response: Response, user: NhanVien = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"
    if user.vai_tro != "QUAN_LY":
        raise HTTPException(403, "Chỉ quản lý được kiểm tra cấu hình kết nối AI.")
    limiter.check(user.id, settings.ai_requests_per_minute)
    if not provider_ready():
        return dict(connected=False, message="Chưa cấu hình đủ AI_ENABLED, OPENAI_API_KEY và AI_MODEL ở backend.")
    try:
        guide = public_guide(allowed_guides(user.vai_tro)[0])
        ask_model("Hướng dẫn xem tổng quan hệ thống Resto.", "dashboard", [], [guide], [], datetime.now(TZ).date().isoformat())
        return dict(connected=True, message="Kết nối AI thành công. Đã nhận và kiểm tra được phản hồi theo cấu trúc yêu cầu.")
    except ProviderUnavailable:
        return dict(connected=False, message="Chưa kết nối được AI. Kiểm tra khóa/model, hạn mức và mạng ở backend; dữ liệu tra cứu vẫn hoạt động.")


@router.post("/chat")
def chat(payload: ChatRequest, response: Response, user: NhanVien = Depends(get_current_user), db: Session = Depends(get_db)):
    role, user_id = user.vai_tro, user.id
    validate_role(role)
    if payload.page and payload.page not in PAGES[role]:
        raise HTTPException(403, "Bạn không có quyền sử dụng trang này.")
    if not (payload.question or payload.guide_id or payload.data_request):
        raise HTTPException(422, "Hãy nhập câu hỏi hoặc chọn một gợi ý.")
    response.headers["Cache-Control"] = "no-store"
    limiter.check(user_id, settings.ai_requests_per_minute)
    docs = allowed_guides(role)
    permitted = {tool["kind"] for tool in allowed_tools(role)}
    context = payload.context if payload.context and payload.context.kind in permitted else None
    search_question = followup_question(payload.question, payload.history, payload.page, role)
    candidates = retrieve(search_question, payload.page, role)
    data_request = payload.data_request
    if not payload.guide_id and not data_request:
        if outside_topic(payload.question):
            return text_reply("scope", SCOPE_MESSAGE)
        # New clients explicitly send context=null to clear filters; legacy clients can use history.
        local_history = payload.history if "context" not in payload.model_fields_set else []
        intent = parse_intent(payload.question, datetime.now(TZ).date(), local_history, context)
        if intent.kind and intent.kind not in permitted:
            return text_reply("scope", "Tài khoản của bạn chưa được cấp quyền tra cứu dữ liệu này.")
        if intent.clarification:
            examples = (["Doanh thu hôm nay", "Doanh thu 7 ngày qua", "Doanh thu tháng này"] if intent.kind == "revenue"
                        else ["Món bán chạy hôm nay", "Món bán chạy 7 ngày qua"] if intent.kind == "dishes" else [])
            prefix = {"dish_trends": "Món nào bán giảm", "cancellations": "Món bị hủy nhiều", "wait_times": "Thời gian xử lý món", "busy_hours": "Giờ cao điểm"}.get(intent.kind)
            if prefix:
                examples = [prefix + " hôm nay", prefix + " 7 ngày qua"]
            pending = DataRequest(kind=intent.kind) if intent.kind in permitted else None
            return text_reply("clarify", intent.clarification, examples, pending)
        data_request = intent.request
    if not payload.guide_id and not data_request and not candidates and not provider_ready():
        return text_reply("scope", SCOPE_MESSAGE)
    mode = "guide"
    notice = ""
    answer = "Đây là hướng dẫn có sẵn cho chức năng bạn đang hỏi."
    if payload.guide_id:
        candidates = [g for g in docs if g["id"] == payload.guide_id]
        if not candidates:
            raise HTTPException(404, "Không tìm thấy hướng dẫn phù hợp với quyền của bạn.")
    elif not data_request and provider_ready():
        try:
            result = ask_model(payload.question, payload.page, payload.history,
                               [public_guide(g) for g in (candidates or docs[:8])], allowed_tools(role), datetime.now(TZ).date().isoformat(), context)
            if result.intent == "out_of_scope":
                return text_reply("scope", SCOPE_MESSAGE)
            if result.intent == "clarify":
                pending = DataRequest(kind=result.kind) if result.kind in permitted else None
                return text_reply("clarify", result.answer, context_update=pending)
            if result.kind != "none":
                if result.kind not in permitted:
                    return text_reply("scope", "Tài khoản của bạn chưa được cấp quyền tra cứu dữ liệu này.")
                tool = next(t for t in allowed_tools(role) if t["kind"] == result.kind)
                if tool["dated"] and (not result.start or not result.end):
                    return text_reply("clarify", "Bạn muốn phân tích khoảng ngày nào? Hãy ghi từ ngày đến ngày.", context_update=DataRequest(kind=result.kind))
                if bool(result.comparison_start) != bool(result.comparison_end):
                    return text_reply("clarify", "Hãy ghi đủ ngày bắt đầu và kết thúc của kỳ so sánh.")
                data_request = DataRequest(kind=result.kind, start=result.start, end=result.end, limit=result.limit,
                    compare_previous=result.compare_previous,
                    comparison=ComparisonRange(start=result.comparison_start, end=result.comparison_end) if result.comparison_start else None)
            else:
                selected = [g for g in (candidates or docs[:8]) if g["id"] in result.source_ids]
                # Refuse ungrounded model answers. Steps/navigation always come from reviewed docs.
                if selected:
                    candidates, answer, mode = selected, result.answer, "ai"
                else:
                    candidates = []
        except (ProviderUnavailable, ValueError):
            notice = "AI tạm thời chưa trả lời được. Đang hiển thị hướng dẫn có sẵn; bạn vẫn có thể dùng Tra cứu dữ liệu."
    elif not data_request:
        notice = "Đang dùng hướng dẫn có sẵn. Hỏi đáp AI cần quản trị viên cấu hình kết nối."
    if data_request:
        if data_request.kind == "dish_trends" and not data_request.comparison:
            data_request = data_request.model_copy(update={"compare_previous": True})
        # Own transaction so auth's normal session refresh stays separate from business reads.
        with Session(bind=db.get_bind(), autoflush=False) as reader:
            if reader.get_bind().dialect.name == "postgresql":
                reader.execute(text("SET TRANSACTION READ ONLY"))
                reader.execute(text("SET LOCAL statement_timeout = '5000ms'"))
            data = read_data(reader, user_id, role, data_request)
        data["request"] = data_request.model_dump(mode="json") | {"start": data["start"], "end": data["end"]}
        if any(has_phrase(payload.question, phrase) for phrase in ("vi sao", "tai sao", "nguyen nhan")):
            data["insights"].append("Số liệu chỉ thể hiện biến động; chưa đủ bằng chứng để kết luận nguyên nhân. Cần đối chiếu nhật ký nghiệp vụ và thông tin thực tế.")
        followups = []
        if data["start"]:
            if data_request.kind in ("revenue", "dish_trends"):
                followups.append("So với kỳ trước?")
            for kind, question in (("dish_trends", "Còn món nào giảm mạnh?"), ("cancellations", "Món bị hủy nhiều?"), ("wait_times", "Thời gian xử lý món?")):
                if kind in permitted and kind != data_request.kind:
                    followups.append(question)
        return dict(mode="data", answer=data["title"], notice=notice, sources=[], data=data,
                    suggestions=(followups or [q for q in EXAMPLES[role] if q != payload.question])[:3], version=KNOWLEDGE_VERSION)
    if not candidates:
        answer = "Tôi chưa có đủ hướng dẫn để trả lời chính xác. Hãy chọn một hướng dẫn trong danh sách hoặc dùng Tra cứu dữ liệu cho số liệu thực tế."
        mode = "guide"
    return dict(mode=mode, answer=answer, notice=notice,
                sources=[public_guide(g) for g in candidates[:3]], data=None, version=KNOWLEDGE_VERSION)
