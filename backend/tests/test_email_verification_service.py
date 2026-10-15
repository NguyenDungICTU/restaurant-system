import unittest
from unittest.mock import patch

from app.services import email_verification as service


class EmailVerificationTests(unittest.TestCase):
    def setUp(self):
        service._OTP.clear()
        service._SEND_HISTORY.clear()
        service._VERIFIED_NONCES.clear()
        service._IN_FLIGHT.clear()

    def test_rejects_non_gmail(self):
        with self.assertRaises(ValueError):
            service.normalize_gmail("abc@yahoo.com")

    @patch("app.services.email_verification._send_message")
    @patch("app.services.email_verification.secrets.randbelow")
    def test_send_verify_and_consume(self, randbelow, send_message):
        randbelow.return_value = 123456
        send_message.return_value = (True, None)

        cooldown = service.send_email_otp(" Demo.User@GMAIL.com ")
        self.assertGreaterEqual(cooldown, 1)

        token = service.verify_email_otp(
            "demo.user@gmail.com",
            "123456",
        )
        nonce = service.validate_email_verification_token(
            "demo.user@gmail.com",
            token,
        )
        service.consume_verified_nonce(
            "demo.user@gmail.com",
            nonce,
        )

        with self.assertRaises(service.OtpVerificationError):
            service.validate_email_verification_token(
                "demo.user@gmail.com",
                token,
            )

    @patch("app.services.email_verification._send_message")
    @patch("app.services.email_verification.secrets.randbelow")
    def test_wrong_otp_rejected(self, randbelow, send_message):
        randbelow.return_value = 654321
        send_message.return_value = (True, None)
        service.send_email_otp("demo@gmail.com")

        with self.assertRaises(service.OtpVerificationError):
            service.verify_email_otp("demo@gmail.com", "111111")


if __name__ == "__main__":
    unittest.main()
