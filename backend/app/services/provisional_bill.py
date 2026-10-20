"""Pure business rules for read-only provisional bills."""


def is_billable_line(status: str, tinh_tien: bool) -> bool:
    """Exclude pre-preparation cancellations; include only billable lines."""
    return bool(tinh_tien) and status in {
        "CHO_BEP", "DANG_CHE_BIEN", "DA_XONG", "DA_PHUC_VU", "DA_HUY"
    }


def line_amount(unit_price, quantity: int) -> int:
    """Menu prices are VND; return the integer VND amount for a line."""
    return int(unit_price) * int(quantity)
