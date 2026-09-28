from functools import lru_cache
from typing import Annotated, Any

from pydantic import BeforeValidator, Field, HttpUrl
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

    qr_frontend_url: HttpUrl = (
        "http://localhost:5173"
    )

    qr_pdf_font_path: str = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    )

    database_url: str

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