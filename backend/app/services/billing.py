"""Pure checkout business rules, independent of the database."""
from decimal import Decimal, ROUND_HALF_UP

def calculate_discount(subtotal, discount_type="NONE", discount_value=0):
    subtotal = Decimal(str(subtotal))
    value = Decimal(str(discount_value or 0))
    if subtotal < 0 or value < 0:
        raise ValueError("Số tiền và giảm giá không được âm.")
    if discount_type == "PERCENT":
        if value > 50:
            raise ValueError("Giảm giá phần trăm tối đa là 50%.")
        discount = (subtotal * value / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        percent = value
        amount = Decimal("0")
    elif discount_type == "AMOUNT":
        if value > (subtotal / Decimal("2")):
            raise ValueError("Giảm giá theo số tiền tối đa là 50% tổng tiền hàng.")
        discount, percent, amount = value, Decimal("0"), value
    elif discount_type == "NONE":
        discount, percent, amount = Decimal("0"), Decimal("0"), Decimal("0")
    else:
        raise ValueError("Loại giảm giá không hợp lệ.")
    return {"discount": int(discount), "percent": percent, "amount": amount, "total": int(subtotal-discount)}

def validate_payment(method, total, cash_received=None, reference=None):
    total = Decimal(str(total))
    if method == "TIEN_MAT":
        if cash_received is None or Decimal(str(cash_received)) < total:
            raise ValueError("Tiền khách đưa phải lớn hơn hoặc bằng tổng thanh toán.")
        received = Decimal(str(cash_received))
        return {"cash_received": received, "change": received-total, "reference": None}
    if method == "CHUYEN_KHOAN":
        if not str(reference or "").strip():
            raise ValueError("Bắt buộc nhập mã tham chiếu chuyển khoản.")
        return {"cash_received": None, "change": None, "reference": str(reference).strip()}
    raise ValueError("Phương thức thanh toán không hợp lệ.")
