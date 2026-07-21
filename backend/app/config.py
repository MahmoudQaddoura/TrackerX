from __future__ import annotations

"""
config.py
Single source of application settings, loaded from environment / .env.

One purpose: expose a cached `settings` object. No DB, no framework logic here.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory (this file lives in backend/app/)
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """All tunable settings. Override any field via an environment variable."""

    app_name: str = "Project Task Tracker API"
    environment: str = "development"

    # Database — SQLite file inside backend/data/
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'app.db'}"

    # Auth / JWT
    jwt_secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720  # 12 hours

    # Document storage (files on disk; metadata in DB)
    documents_dir: Path = BASE_DIR / "data" / "documents"
    max_upload_bytes: int = 50 * 1024 * 1024  # 50 MB

    # CORS — the frontend dev server + any configured public URL
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so settings are parsed only once per process."""
    return Settings()


settings = get_settings()
