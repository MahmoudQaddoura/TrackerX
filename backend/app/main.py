"""
main.py
FastAPI application assembly: CORS, table creation, router mounting, health.
Every router is mounted under /api. One purpose: wire the app together.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app import models  # noqa: F401 — importing registers all tables on Base

from app.routers import (
    analytics,
    auth,
    comments,
    csv_import,
    documents,
    gantt,
    meetings,
    milestones,
    projects,
    tasks,
    team_members,
    teams,
    users,
)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Create any missing tables. (Simple projects skip migration tooling.)"""
    settings.documents_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)


# Auth carries its own /auth prefix; everything else is mounted under /api.
app.include_router(auth.router, prefix="/api")
for r in (
    projects.router,
    milestones.router,
    tasks.router,
    team_members.router,
    teams.router,
    users.router,
    documents.router,
    meetings.router,
    comments.router,
    csv_import.router,
    analytics.router,
    gantt.router,
):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
