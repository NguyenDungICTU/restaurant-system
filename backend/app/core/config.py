from functools import lru_cache
from typing import Annotated, Any

from pydantic import BeforeValidator, Field, HttpUrl, SecretStr
from pydantic_settings import (
    BaseSettings,
    NoDecode,
    SettingsConfigDict,
)


def split_comma_separated(
    value: Any,
) -> Any:
    if isinstance(value, str):
        return [
            item.strip()
            for item in value.split(",")
            if item.strip()
        ]

    return value


CommaSeparatedUrls = Annotated[
    list[str],
    NoDecode,
    BeforeValidator(split_comma_separated),
]


class Settings(BaseSettings):
    project_name: str = (
        "Restaurant Management System"
    )

    # Optional fallback only. In normal LAN use, the frontend sends
    # window.location.origin when downloading a QR, so no LAN IP is stored here.
    qr_frontend_url: HttpUrl | None = None

    qr_pdf_font_path: str = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    )

    database_url: str

    # Server only; never forward these as VITE_* variables.
    ai_enabled: bool = False
    openai_api_key: SecretStr = SecretStr("")
    ai_model: str = ""
    ai_timeout_seconds: int = Field(default=20, ge=5, le=30)
    ai_requests_per_minute: int = Field(default=12, ge=1, le=60)

    session_cookie_name: str = (
        "restaurant_session"
    )

    session_idle_minutes: int = Field(
        default=30,
        ge=1,
    )

    login_max_failed_attempts: int = Field(
        default=5,
        ge=1,
    )

    login_failed_window_minutes: int = Field(
        default=15,
        ge=1,
    )

    login_lock_minutes: int = Field(
        default=15,
        ge=1,
    )

    cookie_secure: bool = False

    cookie_samesite: str = "lax"

    restaurant_name: str = "Nhà hàng"
    restaurant_phone: str = ""
    restaurant_address: str = "Địa chỉ nhà hàng chưa được cấu hình"
    notification_worker_interval_seconds: int = Field(default=10, ge=1, le=60)
    notification_retry_minutes: int = Field(default=5, ge=1, le=60)
    booking_reminder_lead_minutes: int = Field(default=120, ge=1, le=1440)
    booking_reminder_window_minutes: int = Field(default=5, ge=1, le=60)

    email_verification_secret: str = "s4-08-local-dev-secret-change-me"
    email_otp_ttl_minutes: int = Field(default=10, ge=1, le=30)
    email_otp_resend_seconds: int = Field(default=60, ge=10, le=600)
    email_otp_max_sends_per_hour: int = Field(default=3, ge=1, le=20)
    email_otp_max_failed_attempts: int = Field(default=5, ge=1, le=20)
    email_verification_token_minutes: int = Field(default=30, ge=5, le=120)

    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

    frontend_urls: CommaSeparatedUrls = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
