from __future__ import annotations

"""
security.py
Password hashing and JWT creation/verification. One purpose: cryptography.

No DB access, no FastAPI dependencies here — those live in deps.py.
"""

from datetime import datetime, timedelta, timezone

import jwt
from jwt import InvalidTokenError
from passlib.context import CryptContext

from app.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    return _pwd.verify(plain, hashed)


def create_access_token(user_id: int, role: str) -> str:
    """Build a signed JWT carrying the user id (`sub`) and `role`."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT. Raises ValueError on any problem."""
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except InvalidTokenError as exc:  # expired, bad signature, malformed, ...
        raise ValueError("Invalid or expired token") from exc
