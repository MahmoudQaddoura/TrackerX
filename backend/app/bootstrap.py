from __future__ import annotations

"""Validate production settings and create the first administrator if needed."""

import os

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func

from app import models  # noqa: F401 - register every table on Base
from app.config import settings
from app.db import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password
from app.services.password_policy import validate_password


_INSECURE_JWT_SECRETS = {
    "",
    "CHANGE_ME_IN_PRODUCTION",
    "CHANGE_ME_IN_PRODUCTION_USE_32_BYTES",
    "replace-with-a-strong-random-secret",
}
_EXAMPLE_ADMIN_PASSWORD = "replace-with-a-unique-password-of-12-or-more-characters"


def _validate_runtime_settings() -> None:
    if settings.environment.strip().lower() == "production":
        if (
            settings.jwt_secret_key in _INSECURE_JWT_SECRETS
            or len(settings.jwt_secret_key) < 32
        ):
            raise RuntimeError(
                "JWT_SECRET_KEY must be set to a strong, unique value in production."
            )
        if not settings.allowed_hosts or "*" in settings.allowed_hosts:
            raise RuntimeError("ALLOWED_HOSTS must list the production TrackerX host names.")
        if any(origin == "*" or not origin.startswith("https://") for origin in settings.cors_origins):
            raise RuntimeError("CORS_ORIGINS must contain only explicit HTTPS origins in production.")


def _create_initial_admin_if_empty() -> None:
    """Create one administrator only when the users table is completely empty."""

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.query(User).count() > 0:
            return

        email = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
        password = os.getenv("INITIAL_ADMIN_PASSWORD", "")
        full_name = os.getenv("INITIAL_ADMIN_FULL_NAME", "TrackerX Administrator").strip()

        if not email or not password:
            raise RuntimeError(
                "The database has no users. Set INITIAL_ADMIN_EMAIL and "
                "INITIAL_ADMIN_PASSWORD for the first production start."
            )
        if email == "admin@example.com" or password == _EXAMPLE_ADMIN_PASSWORD:
            raise RuntimeError(
                "Replace the example initial-administrator credentials before starting."
            )
        try:
            email = str(TypeAdapter(EmailStr).validate_python(email)).lower()
        except ValidationError as exc:
            raise RuntimeError("INITIAL_ADMIN_EMAIL must be a valid email address.") from exc
        try:
            validate_password(password, (email, full_name))
        except ValueError as exc:
            raise RuntimeError(f"INITIAL_ADMIN_PASSWORD: {exc}") from exc
        if db.query(User).filter(func.lower(User.email) == email).first() is not None:
            return

        db.add(
            User(
                email=email,
                full_name=full_name or "TrackerX Administrator",
                role="admin",
                access_level="write",
                is_enabled=1,
                is_primary_admin=1,
                must_change_password=1,
                hashed_password=hash_password(password),
            )
        )
        db.commit()
        print(f"Created initial TrackerX administrator: {email}")


def bootstrap() -> None:
    _validate_runtime_settings()
    _create_initial_admin_if_empty()


if __name__ == "__main__":
    bootstrap()
