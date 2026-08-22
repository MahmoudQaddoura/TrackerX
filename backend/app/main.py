from __future__ import annotations

"""
main.py
FastAPI application assembly: CORS, table creation, router mounting, health.
Every router is mounted under /api. One purpose: wire the app together.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from app.config import settings
from app.db import Base, engine
from app import models  # noqa: F401 — importing registers all tables on Base

from app.routers import (
    analytics,
    attendance,
    auth,
    comments,
    csv_import,
    documents,
    gantt,
    leave_requests,
    meetings,
    milestones,
    projects,
    tasks,
    team_members,
    users,
)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)


def _migrate_local_schema() -> None:
    """Apply the small additive migrations needed by existing SQLite installs."""
    if engine.dialect.name != "sqlite":
        return

    milestone_columns = {column["name"] for column in inspect(engine).get_columns("milestones")}
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    project_columns = {column["name"] for column in inspect(engine).get_columns("projects")}
    attendance_columns = {
        column["name"] for column in inspect(engine).get_columns("attendance_records")
    }
    leave_request_columns = {
        column["name"] for column in inspect(engine).get_columns("leave_requests")
    }
    with engine.begin() as connection:
        if "workstream" not in milestone_columns:
            connection.exec_driver_sql(
                "ALTER TABLE milestones ADD COLUMN workstream TEXT NOT NULL DEFAULT 'project'"
            )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_milestones_workstream ON milestones (workstream)"
        )
        if "project_type" not in project_columns:
            connection.exec_driver_sql(
                "ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'actual_project'"
            )
        if "parent_project_id" not in project_columns:
            connection.exec_driver_sql(
                "ALTER TABLE projects ADD COLUMN parent_project_id INTEGER REFERENCES projects(id)"
            )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_projects_project_type ON projects (project_type)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_projects_parent_project_id ON projects (parent_project_id)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_task_assignees_team_member_id "
            "ON task_assignees (team_member_id)"
        )
        if "access_level" not in user_columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN access_level TEXT NOT NULL DEFAULT 'read'"
            )
            # Preserve the capabilities of accounts that could already edit or
            # move work. Admin may adjust each employee after migration.
            connection.exec_driver_sql(
                "UPDATE users SET access_level = 'write' WHERE role IN ('admin','pm','developer')"
            )
        if "is_enabled" not in user_columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1"
            )
        if "is_primary_admin" not in user_columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_primary_admin INTEGER NOT NULL DEFAULT 0"
            )
        # Existing installations predate the primary-admin flag. Preserve the
        # earliest enabled administrator as the owner of role assignment.
        connection.exec_driver_sql(
            """
            UPDATE users
            SET is_primary_admin = 1
            WHERE id = (
                SELECT id FROM users
                WHERE role = 'admin' AND is_enabled = 1
                ORDER BY id LIMIT 1
            )
            AND NOT EXISTS (
                SELECT 1 FROM users WHERE is_primary_admin = 1
            )
            """
        )
        if "must_change_password" not in user_columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"
            )
            # Existing employee accounts currently use administrator-issued
            # credentials. Require a private replacement at their next login.
            connection.exec_driver_sql(
                "UPDATE users SET must_change_password = 1 "
                "WHERE role IN ('pm','developer')"
            )
        # Preserve every existing single assignee as the first member of the
        # new multi-assignee relationship. The composite PK makes this safe on
        # every restart.
        connection.exec_driver_sql(
            """
            INSERT OR IGNORE INTO task_assignees (task_id, team_member_id)
            SELECT id, assigned_member_id
            FROM tasks
            WHERE assigned_member_id IS NOT NULL
            """
        )
        if "leave_request_id" not in attendance_columns:
            connection.exec_driver_sql(
                "ALTER TABLE attendance_records ADD COLUMN leave_request_id INTEGER"
            )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_attendance_records_leave_request_id "
            "ON attendance_records (leave_request_id)"
        )
        if "duration_unit" not in leave_request_columns:
            connection.exec_driver_sql(
                "ALTER TABLE leave_requests ADD COLUMN duration_unit TEXT NOT NULL DEFAULT 'days'"
            )
        if "start_time" not in leave_request_columns:
            connection.exec_driver_sql(
                "ALTER TABLE leave_requests ADD COLUMN start_time TEXT"
            )
        if "end_time" not in leave_request_columns:
            connection.exec_driver_sql(
                "ALTER TABLE leave_requests ADD COLUMN end_time TEXT"
            )
        connection.exec_driver_sql("PRAGMA optimize")

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
    _migrate_local_schema()


# Auth carries its own /auth prefix; everything else is mounted under /api.
app.include_router(auth.router, prefix="/api")
for r in (
    projects.router,
    milestones.router,
    tasks.router,
    team_members.router,
    users.router,
    documents.router,
    meetings.router,
    comments.router,
    csv_import.router,
    analytics.router,
    attendance.router,
    leave_requests.router,
    gantt.router,
):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
