from __future__ import annotations

"""Rotate accounts matching explicitly supplied compromised passwords."""

import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import secrets

from app.config import settings
from app.db import SessionLocal
from app.models import User
from app.security import hash_password, verify_password


def _temporary_password() -> str:
    return f"{secrets.token_urlsafe(18)}!Aa1"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if settings.environment.strip().lower() != "production":
        raise RuntimeError("Credential rotation must use the production environment.")
    compromised = [
        value for value in os.getenv("TRACKERX_COMPROMISED_PASSWORDS", "").split("\n") if value
    ]
    if not compromised:
        raise RuntimeError("TRACKERX_COMPROMISED_PASSWORDS must contain at least one password.")

    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    credentials: list[tuple[str, str]] = []
    try:
        for user in db.query(User).order_by(User.id).all():
            if not any(verify_password(candidate, user.hashed_password) for candidate in compromised):
                continue
            password = _temporary_password()
            user.hashed_password = hash_password(password)
            user.must_change_password = 1
            user.auth_version = int(user.auth_version or 0) + 1
            credentials.append((user.email, password))

        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as destination:
                generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
                destination.write(f"TrackerX emergency credential rotation - {generated_at}\n")
                destination.write("Each account must change this temporary password at first sign-in.\n\n")
                for email, password in credentials:
                    destination.write(f"{email}\t{password}\n")
            db.commit()
        except Exception:
            output.unlink(missing_ok=True)
            raise
    finally:
        db.close()

    print(f"Rotated {len(credentials)} accounts. One-time credentials: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
