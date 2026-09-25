from functools import lru_cache

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Restaurant Management System"
    qr_frontend_url: HttpUrl = "http://localhost:5173"
    qr_pdf_font_path: str = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

    database_url: str

    session_cookie_name: str = "restaurant_session"

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

    # Comma-separated list, for example:
    # http://localhost:5173,http://127.0.0.1:5173
    frontend_urls: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.frontend_urls.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
