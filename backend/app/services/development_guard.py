from __future__ import annotations

"""Guard destructive sample-data commands from production execution."""

from app.config import settings


def require_non_production(operation: str) -> None:
    if settings.environment.strip().lower() == "production":
        raise RuntimeError(f"Refusing to run {operation} in the production environment.")
