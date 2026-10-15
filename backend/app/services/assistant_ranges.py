from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.services.revenue_report import validate_report_range

TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def money_text(value):
    return f"{value:,}".replace(",", ".") + " ₫"


def range_bounds(start, end):
    try:
        days = validate_report_range(start, end)
        if end.year >= 9999:
            raise ValueError("Khoảng ngày không được hỗ trợ.")
        return (datetime.combine(start, time.min, tzinfo=TZ),
                datetime.combine(end + timedelta(days=1), time.min, tzinfo=TZ), days)
    except (ValueError, OverflowError) as exc:
        raise HTTPException(422, str(exc) or "Khoảng ngày không hợp lệ.") from exc


def comparison_range(request, start, end):
    _, _, days = range_bounds(start, end)
    if request.comparison:
        old_start, old_end = request.comparison.start, request.comparison.end
    else:
        try:
            old_end = start - timedelta(days=1)
            old_start = old_end - timedelta(days=days - 1)
        except OverflowError as exc:
            raise HTTPException(422, "Không thể tính kỳ trước cho khoảng ngày này.") from exc
    range_bounds(old_start, old_end)
    return old_start, old_end
