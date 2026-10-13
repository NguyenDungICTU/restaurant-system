import unittest
from app.services.billing import calculate_discount, validate_payment

class BillingLogicTest(unittest.TestCase):
    def test_percentage_discount(self):
        self.assertEqual(calculate_discount(100000, "PERCENT", 15)["total"], 85000)
    def test_percentage_discount_capped_at_50(self):
        with self.assertRaisesRegex(ValueError, "50%"):
            calculate_discount(100000, "PERCENT", 50.01)
    def test_fixed_discount_capped_at_half_subtotal(self):
        with self.assertRaisesRegex(ValueError, "50%"):
            calculate_discount(100000, "AMOUNT", 50001)
    def test_discount_requires_reason_is_enforced_by_checkout_contract(self):
        self.assertEqual(calculate_discount(100000, "AMOUNT", 10000)["discount"], 10000)
    def test_cash_change(self):
        self.assertEqual(validate_payment("TIEN_MAT", 85000, 100000)["change"], 15000)
    def test_cash_must_cover_total(self):
        with self.assertRaisesRegex(ValueError, "lớn hơn hoặc bằng"):
            validate_payment("TIEN_MAT", 85000, 80000)
    def test_transfer_requires_reference(self):
        with self.assertRaisesRegex(ValueError, "tham chiếu"):
            validate_payment("CHUYEN_KHOAN", 85000, reference=" ")
        self.assertEqual(validate_payment("CHUYEN_KHOAN", 85000, reference="TX-123")["reference"], "TX-123")

if __name__ == "__main__":
    unittest.main(verbosity=2)
