import pytest
from app.services.shift_close import calculate_cash_difference, validate_variance_explanation

def test_exact_cash_match():
    assert calculate_cash_difference(1_000_000, 1_000_000) == 0

def test_cash_shortage_is_negative():
    assert calculate_cash_difference(1_000_000, 950_000) == -50_000

def test_threshold_is_strictly_greater_than_50000():
    assert validate_variance_explanation(50_000, None)
    assert validate_variance_explanation(-50_000, None)
    with pytest.raises(ValueError):
        validate_variance_explanation(50_001, " ")
    with pytest.raises(ValueError):
        validate_variance_explanation(-50_001, "ok")
    assert validate_variance_explanation(50_001, "Sai tiền lẻ")

def test_negative_money_is_rejected():
    with pytest.raises(ValueError):
        calculate_cash_difference(-1, 0)
