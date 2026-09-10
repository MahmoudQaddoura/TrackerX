from __future__ import annotations

"""Read-only production security and database integrity audit."""

import json
import os
from pathlib import Path
import sqlite3
import stat

from app.config import settings
from app.security import verify_password
from app.services.data_backup import sqlite_database_path


def _mode(path: Path) -> str:
    return f"{stat.S_IMODE(path.stat().st_mode):03o}"


def main() -> int:
    database = sqlite_database_path()
    uri = f"file:{database.as_posix()}?mode=ro"
    with sqlite3.connect(uri, uri=True) as connection:
        table_count = int(
            connection.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'"
            ).fetchone()[0]
        )
        user_count = int(connection.execute("SELECT COUNT(*) FROM users").fetchone()[0])
        enabled_users = int(
            connection.execute("SELECT COUNT(*) FROM users WHERE is_enabled = 1").fetchone()[0]
        )
        primary_admins = int(
            connection.execute(
                "SELECT COUNT(*) FROM users "
                "WHERE role = 'admin' AND is_enabled = 1 AND is_primary_admin = 1"
            ).fetchone()[0]
        )
        duplicate_emails = len(
            connection.execute(
                "SELECT lower(email) FROM users GROUP BY lower(email) HAVING COUNT(*) > 1"
            ).fetchall()
        )
        invalid_accounts = int(
            connection.execute(
                "SELECT COUNT(*) FROM users WHERE role NOT IN ('admin','pm','developer','client') "
                "OR access_level NOT IN ('read','write') OR is_enabled NOT IN (0,1)"
            ).fetchone()[0]
        )
        integrity = str(connection.execute("PRAGMA quick_check").fetchone()[0])
        foreign_key_violations = len(connection.execute("PRAGMA foreign_key_check").fetchall())
        password_rows = connection.execute("SELECT hashed_password FROM users").fetchall()

    compromised = [
        value for value in os.getenv("TRACKERX_COMPROMISED_PASSWORDS", "").split("\n") if value
    ]
    compromised_accounts = sum(
        1
        for (password_hash,) in password_rows
        if any(verify_password(candidate, password_hash) for candidate in compromised)
    )
    report = {
        "environment": settings.environment,
        "database": {
            "file_mode": _mode(database),
            "directory_mode": _mode(database.parent),
            "table_count": table_count,
            "user_count": user_count,
            "enabled_users": enabled_users,
            "primary_admins": primary_admins,
            "duplicate_emails": duplicate_emails,
            "invalid_accounts": invalid_accounts,
            "integrity": integrity,
            "foreign_key_violations": foreign_key_violations,
            "compromised_password_accounts": compromised_accounts,
        },
        "configuration": {
            "jwt_secret_length": len(settings.jwt_secret_key),
            "allowed_hosts": settings.allowed_hosts,
            "cors_origins": settings.cors_origins,
            "document_storage": settings.document_storage,
            "backup_on_startup": settings.backup_on_startup,
        },
    }
    print(json.dumps(report, indent=2))
    healthy = all(
        (
            settings.environment.strip().lower() == "production",
            len(settings.jwt_secret_key) >= 32,
            integrity == "ok",
            foreign_key_violations == 0,
            duplicate_emails == 0,
            invalid_accounts == 0,
            primary_admins == 1,
            compromised_accounts == 0,
            _mode(database) == "600",
            _mode(database.parent) == "700",
        )
    )
    return 0 if healthy else 2


if __name__ == "__main__":
    raise SystemExit(main())
