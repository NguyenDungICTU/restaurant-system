"""S4-08 Gmail OTP verification without a new database migration.

OTP state is kept in memory so this can be added without touching Alembic.
For multi-worker production, move the state to Redis or a DB-backed store.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import base64
import hashlib
import hmac
import json
import re
import secrets
from threading import RLock

from app.core.config import settings
from app.services.email_service import _send_message


_GMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@gmail\.com$", re.IGNORECASE)
_LOCK = RLock()


@dataclass
class OtpChallenge:
    otp_hash: str
    expires_at: datetime
    sent_at: datetime
    failed_attempts: int = 0


@dataclass
class VerifiedNonce:
    email: str
    expires_at: datetime


_OTP: dict[str, OtpChallenge] = {}
_SEND_HISTORY: dict[str, deque[datetime]] = defaultdict(deque)
_VERIFIED_NONCES: dict[str, VerifiedNonce] = {}
_IN_FLIGHT: set[str] = set()


class OtpRateLimitError(Exception):
    def __init__(self, message: str, retry_after_seconds: int):
        super().__init__(message)
        self.retry_after_seconds = max(int(retry_after_seconds), 1)


class OtpDeliveryError(Exception):
    pass


class OtpVerificationError(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_gmail(email: str) -> str:
    normalized = (email or "").strip().lower()
    if not _GMAIL_RE.fullmatch(normalized):
        raise ValueError("Chỉ chấp nhận địa chỉ Gmail hợp lệ có đuôi @gmail.com.")
    return normalized


def _secret_bytes() -> bytes:
    value = settings.email_verification_secret.strip()
    if len(value) < 16:
        raise RuntimeError(
            "EMAIL_VERIFICATION_SECRET phải có ít nhất 16 ký tự."
        )
    return value.encode("utf-8")


def _otp_hash(email: str, otp: str) -> str:
    return hmac.new(
        _secret_bytes(),
        f"{email}:{otp}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _prune(now: datetime) -> None:
    for email, history in list(_SEND_HISTORY.items()):
        while history and now - history[0] >= timedelta(hours=1):
            history.popleft()
        if not history:
            _SEND_HISTORY.pop(email, None)

    for email, challenge in list(_OTP.items()):
        if challenge.expires_at <= now:
            _OTP.pop(email, None)

    for nonce, verified in list(_VERIFIED_NONCES.items()):
        if verified.expires_at <= now:
            _VERIFIED_NONCES.pop(nonce, None)


def _otp_email(email: str, otp: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = "Mã xác minh Gmail đặt bàn - Resto"
    message["From"] = settings.smtp_from_email
    message["To"] = email
    message.set_content(
        f"""Xin chào,

Mã xác minh Gmail cho yêu cầu đặt bàn tại Resto là:

{otp}

Mã có hiệu lực trong {settings.email_otp_ttl_minutes} phút.
Không chia sẻ mã này cho người khác.

Nếu bạn không thực hiện yêu cầu này, có thể bỏ qua email.

Trân trọng,
Nhà hàng Resto
"""
    )
    return message


def send_email_otp(email: str) -> int:
    normalized = normalize_gmail(email)
    now = _utcnow()
    cooldown = settings.email_otp_resend_seconds
    max_per_hour = settings.email_otp_max_sends_per_hour

    with _LOCK:
        _prune(now)

        if normalized in _IN_FLIGHT:
            raise OtpRateLimitError(
                "Yêu cầu gửi OTP đang được xử lý. Vui lòng chờ.",
                5,
            )

        current = _OTP.get(normalized)
        if current is not None:
            elapsed = int((now - current.sent_at).total_seconds())
            if elapsed < cooldown:
                raise OtpRateLimitError(
                    "Vui lòng chờ trước khi gửi lại mã OTP.",
                    cooldown - elapsed,
                )

        history = _SEND_HISTORY[normalized]
        if len(history) >= max_per_hour:
            retry_after = int(
                (
                    timedelta(hours=1) - (now - history[0])
                ).total_seconds()
            )
            raise OtpRateLimitError(
                "Email này đã yêu cầu OTP quá nhiều lần trong 1 giờ.",
                retry_after,
            )

        _IN_FLIGHT.add(normalized)

    otp = f"{secrets.randbelow(1_000_000):06d}"

    try:
        ok, error = _send_message(_otp_email(normalized, otp))
        if not ok:
            raise OtpDeliveryError(
                error or "SMTP từ chối gửi email OTP."
            )

        saved_at = _utcnow()
        with _LOCK:
            _OTP[normalized] = OtpChallenge(
                otp_hash=_otp_hash(normalized, otp),
                expires_at=saved_at
                + timedelta(minutes=settings.email_otp_ttl_minutes),
                sent_at=saved_at,
                failed_attempts=0,
            )
            _SEND_HISTORY[normalized].append(saved_at)

        return cooldown
    finally:
        with _LOCK:
            _IN_FLIGHT.discard(normalized)


def _encode_token(payload: dict) -> str:
    raw = json.dumps(
        payload,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    body = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
    signature = hmac.new(
        _secret_bytes(),
        body.encode("ascii"),
        hashlib.sha256,
    ).digest()
    sig = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    return f"{body}.{sig}"


def _decode_token(token: str) -> dict:
    try:
        body, sig = token.split(".", 1)
    except ValueError as exc:
        raise OtpVerificationError(
            "Token xác minh Gmail không hợp lệ."
        ) from exc

    expected = hmac.new(
        _secret_bytes(),
        body.encode("ascii"),
        hashlib.sha256,
    ).digest()

    try:
        actual = base64.urlsafe_b64decode(
            sig + "=" * (-len(sig) % 4)
        )
    except Exception as exc:
        raise OtpVerificationError(
            "Token xác minh Gmail không hợp lệ."
        ) from exc

    if not hmac.compare_digest(expected, actual):
        raise OtpVerificationError(
            "Token xác minh Gmail không hợp lệ."
        )

    try:
        raw = base64.urlsafe_b64decode(
            body + "=" * (-len(body) % 4)
        )
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise OtpVerificationError(
            "Token xác minh Gmail không hợp lệ."
        ) from exc

    return payload


def verify_email_otp(email: str, otp: str) -> str:
    normalized = normalize_gmail(email)
    otp = (otp or "").strip()

    if not re.fullmatch(r"\d{6}", otp):
        raise OtpVerificationError(
            "Mã OTP phải gồm đúng 6 chữ số."
        )

    now = _utcnow()

    with _LOCK:
        _prune(now)
        challenge = _OTP.get(normalized)

        if challenge is None:
            raise OtpVerificationError(
                "Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng gửi mã mới."
            )

        if challenge.expires_at <= now:
            _OTP.pop(normalized, None)
            raise OtpVerificationError(
                "Mã OTP đã hết hạn. Vui lòng gửi mã mới."
            )

        if not hmac.compare_digest(
            challenge.otp_hash,
            _otp_hash(normalized, otp),
        ):
            challenge.failed_attempts += 1
            remaining = (
                settings.email_otp_max_failed_attempts
                - challenge.failed_attempts
            )
            if remaining <= 0:
                _OTP.pop(normalized, None)
                raise OtpVerificationError(
                    "Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi mã mới."
                )
            raise OtpVerificationError(
                f"Mã OTP không chính xác. Còn {remaining} lần thử."
            )

        _OTP.pop(normalized, None)

        nonce = secrets.token_urlsafe(24)
        expires_at = now + timedelta(
            minutes=settings.email_verification_token_minutes
        )
        _VERIFIED_NONCES[nonce] = VerifiedNonce(
            email=normalized,
            expires_at=expires_at,
        )

    return _encode_token(
        {
            "email": normalized,
            "nonce": nonce,
            "exp": int(expires_at.timestamp()),
        }
    )


def validate_email_verification_token(
    email: str,
    token: str,
) -> str:
    normalized = normalize_gmail(email)
    payload = _decode_token((token or "").strip())
    now = _utcnow()

    if payload.get("email") != normalized:
        raise OtpVerificationError(
            "Token xác minh không thuộc Gmail đang sử dụng."
        )

    try:
        expires_at = datetime.fromtimestamp(
            int(payload["exp"]),
            tz=timezone.utc,
        )
        nonce = str(payload["nonce"])
    except Exception as exc:
        raise OtpVerificationError(
            "Token xác minh Gmail không hợp lệ."
        ) from exc

    if expires_at <= now:
        raise OtpVerificationError(
            "Xác minh Gmail đã hết hạn. Vui lòng xác minh lại."
        )

    with _LOCK:
        _prune(now)
        state = _VERIFIED_NONCES.get(nonce)
        if (
            state is None
            or state.email != normalized
            or state.expires_at <= now
        ):
            raise OtpVerificationError(
                "Xác minh Gmail không còn hiệu lực. Vui lòng xác minh lại."
            )

    return nonce


def consume_verified_nonce(email: str, nonce: str) -> None:
    normalized = normalize_gmail(email)
    now = _utcnow()

    with _LOCK:
        _prune(now)
        state = _VERIFIED_NONCES.get(nonce)
        if (
            state is None
            or state.email != normalized
            or state.expires_at <= now
        ):
            raise OtpVerificationError(
                "Xác minh Gmail không còn hiệu lực. Vui lòng xác minh lại."
            )
        _VERIFIED_NONCES.pop(nonce, None)
