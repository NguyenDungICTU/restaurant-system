"""Run in backend container: python scripts/test_provisional_bill_logic.py"""
import unittest
from app.services.provisional_bill import is_billable_line, line_amount

class ProvisionalBillRulesTest(unittest.TestCase):
    def test_cancelled_before_preparation_is_excluded(self):
        self.assertFalse(is_billable_line("DA_HUY", False))

    def test_cancelled_billable_after_preparation_is_included(self):
        self.assertTrue(is_billable_line("DA_HUY", True))

    def test_active_billable_order_line_is_included(self):
        self.assertTrue(is_billable_line("CHO_BEP", True))

    def test_non_billable_line_is_excluded(self):
        self.assertFalse(is_billable_line("DA_PHUC_VU", False))

    def test_vnd_line_total(self):
        self.assertEqual(line_amount(45000, 3), 135000)

if __name__ == "__main__":
    unittest.main(verbosity=2)
