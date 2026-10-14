"""Pure rules for cashier shift closing."""
CASH_VARIANCE_EXPLANATION_THRESHOLD = 50_000

def calculate_cash_difference(system_cash, counted_cash):
    system_cash = int(system_cash)
    counted_cash = int(counted_cash)
    if system_cash < 0 or counted_cash < 0:
        raise ValueError("Số tiền không được âm.")
    return counted_cash - system_cash

def validate_variance_explanation(difference, explanation):
    if abs(int(difference)) > CASH_VARIANCE_EXPLANATION_THRESHOLD and len((explanation or "").strip()) < 3:
        raise ValueError("Chênh lệch vượt 50.000 VND; bắt buộc nhập giải trình ít nhất 3 ký tự.")
    return True
