"""Conservative Vietnamese data intents. No LLM, SQL or permission decisions here."""
import calendar
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta

from app.schemas.assistant import ComparisonRange, DataRequest
from app.services.assistant_knowledge import has_phrase, outside_topic


EXAMPLES = {
    "QUAN_LY": ["Doanh thu tuần này", "Món nào bán giảm 7 ngày qua?", "Món bị hủy nhiều tuần này", "Thời gian xử lý món tuần này", "Giờ cao điểm tuần này", "Bàn nào còn trống?"],
    "PHUC_VU": ["Bàn nào còn trống?", "Có bao nhiêu món chờ mang ra?", "Thời gian xử lý món hôm nay"],
    "BEP": ["Có bao nhiêu món chờ bếp?", "Món nào đã xong?", "Thời gian xử lý món hôm nay"],
    "THU_NGAN": ["Bàn nào đang chờ thanh toán?", "Doanh thu ca của tôi", "Ca đang mở của tôi"],
}


@dataclass
class Intent:
    request: DataRequest | None = None
    clarification: str | None = None
    kind: str | None = None


class UnclearDate(ValueError):
    pass


def clean(value):
    value = unicodedata.normalize("NFD", value.lower().replace("đ", "d"))
    value = "".join(c for c in value if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9/\s-]", " ", value).split())


def data_kind(text):
    if re.search(r"\b(cach|huong dan|lam the nao|o dau|y nghia|la gi)\b", text):
        return None
    if re.search(r"\bmon\b.*\b(giam|sut|it hon)\b", text):
        return "dish_trends"
    if (re.search(r"\b(?:mon|huy)\b", text) and has_phrase(text, "huy")
            and re.search(r"\b(nhieu|thong ke|phan tich|bao nhieu|so luong|ty le)\b", text)):
        return "cancellations"
    if any(has_phrase(text, p) for p in ("thoi gian cho", "cho lau", "xu ly mon", "toc do bep", "che bien bao lau", "mang mon cham")):
        return "wait_times"
    if any(has_phrase(text, p) for p in ("gio cao diem", "gio dong khach", "gio dong nhat", "khung gio tiep nhan", "gio nhieu don")):
        return "busy_hours"
    if any(has_phrase(text, p) for p in ("ca cua toi", "ca dang mo", "doanh thu ca", "so lieu ca")):
        return "shift"
    if any(has_phrase(text, p) for p in ("doanh thu", "tong thu", "ban duoc bao nhieu tien", "thu duoc bao nhieu", "tien ban hang")):
        return "revenue"
    if any(has_phrase(text, p) for p in ("ban chay", "top mon", "mon ban nhieu", "bao cao mon")) or re.search(r"\btop \d+ mon\b", text):
        return "dishes"
    if re.search(r"\b(?:ban|phien ban)\b.*\b(?:cho thanh toan|can thanh toan)\b", text):
        return "checkouts"
    if (re.search(r"\bban\b.*\btrong\b", text)
            or any(has_phrase(text, p) for p in ("trang thai ban", "so ban dang don"))):
        return "tables"
    if any(has_phrase(text, p) for p in ("tien do mon", "mon cho bep", "mon dang che bien", "mon da xong", "mon nao da xong", "mon cho mang ra", "mon chua mang ra", "trang thai mon")):
        return "orders"
    return None


def date_range(text, today):
    """Require an explicit supported interval; never turn unknown dates into today."""
    values = re.findall(r"\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}/\d{1,2}/\d{4})\b", text)
    if values:
        if len(values) > 2:
            raise UnclearDate("Mỗi lần tra cứu chỉ chọn một khoảng ngày.")
        if len(values) == 1 and re.search(r"\btu\b.*\b(?:den|toi)\b", text):
            raise UnclearDate("Hãy ghi đủ cả ngày bắt đầu và ngày kết thúc, ví dụ từ 01/10/2026 đến 15/10/2026.")
        parsed = []
        try:
            for value in values:
                parts = [int(x) for x in re.split(r"[-/]", value)]
                parsed.append(date(*parts) if "-" in value else date(parts[2], parts[1], parts[0]))
        except ValueError as exc:
            raise UnclearDate("Ngày không hợp lệ. Dùng DD/MM/YYYY hoặc YYYY-MM-DD.") from exc
        if len(parsed) == 2 and not re.search(r"\b(?:tu|den|toi)\b", text):
            raise UnclearDate("Hãy viết rõ 'từ DD/MM/YYYY đến DD/MM/YYYY'.")
        return parsed[0], parsed[-1]
    # Reject partial/invalid numeric dates, including dates with no year.
    if re.search(r"\d+[/-]\d+", text):
        month = re.search(r"\bthang (\d{1,2})/(\d{4})\b", text)
        if not month:
            raise UnclearDate("Hãy ghi đủ ngày/tháng/năm, ví dụ 15/10/2026.")
        try:
            m, y = map(int, month.groups())
            return date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])
        except (ValueError, calendar.IllegalMonthError) as exc:
            raise UnclearDate("Tháng hoặc năm không hợp lệ.") from exc
    choices = []
    if has_phrase(text, "hom nay"):
        choices.append((today, today))
    if has_phrase(text, "hom qua"):
        day = today - timedelta(days=1)
        choices.append((day, day))
    if has_phrase(text, "tuan nay"):
        choices.append((today - timedelta(days=today.weekday()), today))
    if has_phrase(text, "tuan truoc"):
        end = today - timedelta(days=today.weekday() + 1)
        choices.append((end - timedelta(days=6), end))
    if has_phrase(text, "thang nay"):
        choices.append((today.replace(day=1), today))
    if has_phrase(text, "thang truoc"):
        end = today.replace(day=1) - timedelta(days=1)
        choices.append((end.replace(day=1), end))
    days = re.search(r"\b(\d+) ngay (?:qua|gan day)\b", text)
    if days:
        count = int(days[1])
        if not 1 <= count <= 92:
            raise UnclearDate("Mỗi lần chỉ tra cứu từ 1 đến 92 ngày.")
        choices.append((today - timedelta(days=count - 1), today))
    if len(choices) == 1:
        return choices[0]
    if len(choices) > 1:
        raise UnclearDate("Có nhiều khoảng ngày trong câu hỏi. Hãy ghi rõ khoảng tra cứu hoặc dùng 'so với' để so sánh.")
    raise UnclearDate("Bạn muốn xem khoảng nào? Hãy chọn hôm nay, hôm qua, tuần này, tháng này hoặc ghi từ ngày đến ngày.")


DATED_KINDS = {"revenue", "dishes", "dish_trends", "cancellations", "wait_times", "busy_hours"}


def parse_intent(question, today, history=(), context=None):
    if outside_topic(question):
        return Intent()
    text = clean(question)
    kind = data_kind(text)
    temporal_followup = re.fullmatch(r"(?:(?:con|the con|vay|vay con) )?(?:hom qua|hom nay|tuan nay|thang nay|tuan truoc|thang truoc)(?: thi sao| the nao)?", text)
    compare_followup = re.fullmatch(r"(?:(?:vay|con) )?so (?:voi|sanh voi) (?:ky truoc|tuan truoc|thang truoc|hom qua)(?: thi sao)?", text)
    reason_followup = re.fullmatch(r"(?:vi sao giam|tai sao giam|nguyen nhan la gi|vi sao lai giam)", text)
    if context is None and history:
        previous = next((m for m in reversed(history) if m.role == "user"), None)
        if previous and not outside_topic(previous.content):
            context = parse_intent(previous.content, today).request
    if not kind and (temporal_followup or compare_followup or reason_followup) and context:
        kind = context.kind
    if not kind:
        if temporal_followup or compare_followup or reason_followup:
            return Intent(clarification="Bạn đang muốn xem chức năng nào? Hãy hỏi doanh thu, món bán chạy hoặc thời gian xử lý kèm khoảng ngày trước.")
        return Intent()
    dated = kind in DATED_KINDS
    try:
        top = re.search(r"\btop (\d+)\b", text)
        limit = (int(top[1]) if kind in ("dishes", "dish_trends", "cancellations", "wait_times") and top
                 else context.limit if context and context.kind == kind else 10)
        if not 1 <= limit <= 10:
            raise UnclearDate("Bạn có thể xem Top từ 1 đến 10 món. Hãy chọn số lượng trong giới hạn này.")
        if not dated:
            if re.search(r"\b(hom qua|tuan truoc|thang truoc|ngay qua|ngay gan day|tuan nay|thang nay|so sanh)\b|\d+[/-]\d+", text):
                raise UnclearDate("Tra cứu này chỉ hỗ trợ trạng thái hiện tại. Chưa có dữ liệu lịch sử hoặc so sánh cho mục này.")
            return Intent(request=DataRequest(kind=kind), kind=kind)
        parts = re.split(r"\b(?:so voi|voi|vs)\b", text, maxsplit=1)
        comparing = has_phrase(text, "so sanh") or len(parts) == 2
        if comparing and kind not in ("revenue", "dish_trends"):
            raise UnclearDate("So sánh hiện hỗ trợ doanh thu hoặc món giảm số lượng bán. Hãy xem các phân tích khác theo từng khoảng ngày.")
        # Only inherit filters if the question contains no new date expression.
        # A new unsupported interval (e.g. 'năm trước') must still ask for clarification.
        has_new_date = re.search(r"\b(hom|ngay|tuan|thang|quy|nam)\b|\d+[/-]\d+", parts[0])
        if context and context.kind in DATED_KINDS and context.start and context.end and not has_new_date:
            start, end = context.start, context.end
        else:
            start, end = date_range(parts[0], today)
        comparison = None
        auto_previous = False
        if comparing:
            if len(parts) == 2 and not has_phrase(parts[1], "ky truoc"):
                old_start, old_end = date_range(parts[1], today)
                comparison = ComparisonRange(start=old_start, end=old_end)
            else:
                auto_previous = True
        elif kind == "dish_trends":
            if context and context.kind in ("revenue", "dish_trends") and context.start == start and context.end == end:
                comparison, auto_previous = context.comparison, context.compare_previous
            if not comparison:
                auto_previous = True
        return Intent(request=DataRequest(kind=kind, start=start, end=end,
                      compare_previous=auto_previous, comparison=comparison, limit=limit), kind=kind)
    except UnclearDate as exc:
        return Intent(clarification=str(exc), kind=kind)
