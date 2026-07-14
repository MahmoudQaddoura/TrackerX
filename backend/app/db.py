"""
db.py
Database engine, session factory, declarative Base, and the request-scoped
session dependency. One purpose: own the SQLAlchemy connection lifecycle.

No models are defined here (see app/models/) and no business logic lives here.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# SQLite needs check_same_thread=False so the connection can be shared across
# FastAPI's threadpool. For other databases this flag is simply ignored.
_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

# Make sure the SQLite parent directory exists before the engine opens the file.
if settings.database_url.startswith("sqlite:///"):
    Path(settings.database_url.replace("sqlite:///", "")).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.database_url, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base shared by every model."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def now_iso() -> str:
    """Current UTC timestamp as an ISO-8601 string (how we store all timestamps)."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
