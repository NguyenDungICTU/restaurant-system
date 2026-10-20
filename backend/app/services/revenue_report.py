"""Pure business logic for restaurant revenue reports."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal


MAX_REPORT_DAYS = 92


def validate_report_range(start_date: date, end_date: date) -> int:
    if end_date < start_date:
        raise ValueError("Ngày kết thúc phải từ ngày bắt đầu trở đi.")
    days = (end_date - start_date).days + 1
    if days > MAX_REPORT_DAYS:
        raise ValueError("Mỗi lần xem chỉ được chọn tối đa 92 ngày.")
    return days


def local_datetime(value: datetime, tz) -> datetime:
    """Normalize timestamps from PostgreSQL or SQLite test fixtures to local time."""
    if value.tzinfo is None:
        return value.replace(tzinfo=tz)
    return value.astimezone(tz)


def build_hourly_revenue(invoices, start_date: date, end_date: date, timezone, open_hours):
    """Sum finalized invoices by clock hour, only for hours when the restaurant opens.

    open_hours is an iterable of (weekday, opens_at, closes_at), with weekday
    using Python's Monday=0 convention. Empty/missing hours are omitted.
    """
    valid_hours = set()
    current = start_date
    schedule = {weekday: (opens, closes) for weekday, opens, closes in open_hours}
    while current <= end_date:
        entry = schedule.get(current.weekday())
        if entry and entry[0] and entry[1] and entry[1] > entry[0]:
            opens, closes = entry
            for hour in range(opens.hour, min(24, closes.hour + (1 if closes.minute else 0))):
                if hour >= opens.hour and (hour < closes.hour or (hour == closes.hour and closes.minute > 0)):
                    valid_hours.add(hour)
        current += timedelta(days=1)

    totals = {hour: Decimal("0") for hour in sorted(valid_hours)}
    for invoice in invoices:
        stamp = local_datetime(invoice.chot_at, timezone)
        if start_date <= stamp.date() <= end_date and stamp.hour in totals:
            totals[stamp.hour] += Decimal(str(invoice.tong_thanh_toan or 0))
    return [{"hour": hour, "label": f"{hour:02d}:00–{(hour + 1) % 24:02d}:00",
             "revenue": int(amount)} for hour, amount in totals.items()]


def summarize_invoices(invoices):
    valid = [item for item in invoices if item.trang_thai == "DA_CHOT"]
    revenue = sum((Decimal(str(item.tong_thanh_toan or 0)) for item in valid), Decimal("0"))
    count = len(valid)
    return {
        "revenue": int(revenue),
        "invoice_count": count,
        "average_invoice": int(revenue / count) if count else 0,
        "has_transactions": count > 0,
    }
