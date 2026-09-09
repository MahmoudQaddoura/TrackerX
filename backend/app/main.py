from __future__ import annotations

"""
main.py
FastAPI application assembly: CORS, table creation, router mounting, health.
Every router is mounted under /api. One purpose: wire the app together.
"""

import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, SessionLocal, engine, get_db
from app import models  # noqa: F401 — importing registers all tables on Base

from app.routers import (
    analytics,
    assets,
    attendance,
    auth,
    comments,
    clients,
    coverage,
    csv_import,
    documents,
    employee_profile_files,
    gantt,
    leave_requests,
    meetings,
    milestones,
    notifications,
    projects,
    support,
    tasks,
    team_members,
    users,
)
from app.services.data_backup import create_data_backup
from app.services.document_storage import normalize_document_storage_paths
from app.services.object_store import get_document_store


logger = logging.getLogger(__name__)
_production = settings.environment.strip().lower() == "production"

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url=None if _production else "/api/docs",
    redoc_url=None if _production else "/api/redoc",
    openapi_url=None if _production else "/api/openapi.json",
)


def _migrate_local_schema() -> None:
    """Apply the small additive migrations needed by existing SQLite installs."""
    if engine.dialect.name != "sqlite":
        return

    milestone_columns = {column["name"] for column in inspect(engine).get_columns("milestones")}
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    project_columns = {column["name"] for column in inspect(engine).get_columns("projects")}
    team_member_columns = {
        column["name"] for column in inspect(engine).get_columns("team_members")
    }
    attendance_columns = {
        column["name"] for column in inspect(engine).get_columns("attendance_records")
    }
    leave_request_columns = {
        column["name"] for column in inspect(engine).get_columns("leave_requests")
    }
    proactive_report_columns = {
        column["name"] for column in inspect(engine).get_columns("proactive_service_reports")
    }
    support_incident_columns = {
        column["name"] for column in inspect(engine).get_columns("support_incidents")
    }
    with engine.begin() as connection:
        if "service_area_name" not in proactive_report_columns:
            connection.exec_driver_sql(
                "ALTER TABLE proactive_service_reports ADD COLUMN service_area_name TEXT"
            )
        incident_additions = {
            "detection_source": "TEXT NOT NULL DEFAULT 'team'",
            "reported_by_name": "TEXT",
            "affected_service": "TEXT",
            "containment_actions": "TEXT",
            "root_cause": "TEXT",
            "recovery_validation": "TEXT",
            "lessons_learned": "TEXT",
        }
        for column_name, definition in incident_additions.items():
            if column_name not in support_incident_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE support_incidents ADD COLUMN {column_name} {definition}"
                )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_support_incidents_detection_source "
            "ON support_incidents (detection_source)"
        )
        # Correct the original demo seed where the patch report inherited the
        # health-check category, which otherwise under-counts service coverage.
        connection.exec_driver_sql(
            "UPDATE proactive_service_reports SET category = 'patch_update' "
            "WHERE title = 'Patch Update Report' AND category = 'health_check'"
        )
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
        if "name_arabic" not in team_member_columns:
            connection.exec_driver_sql("ALTER TABLE team_members ADD COLUMN name_arabic TEXT")
        if "role_description" not in team_member_columns:
            connection.exec_driver_sql("ALTER TABLE team_members ADD COLUMN role_description TEXT")
        if "employee_number" not in team_member_columns:
            connection.exec_driver_sql("ALTER TABLE team_members ADD COLUMN employee_number TEXT")
            member_rows = list(
                connection.exec_driver_sql(
                    """
                    SELECT tm.id, tm.name, tm.is_active,
                           COALESCE(u.is_primary_admin, 0) AS is_primary_admin
                    FROM team_members AS tm
                    LEFT JOIN users AS u ON u.id = tm.user_id
                    """
                ).mappings()
            )
            member_rows.sort(
                key=lambda row: (
                    0 if row["is_primary_admin"] else
                    1 if row["name"].strip().lower().startswith("yazan") else
                    2 if row["is_active"] else 3,
                    row["id"],
                )
            )
            for number, row in enumerate(member_rows, start=1):
                connection.exec_driver_sql(
                    "UPDATE team_members SET employee_number = ? WHERE id = ?",
                    (f"{number:04d}", row["id"]),
                )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_team_members_employee_number "
            "ON team_members (employee_number)"
        )
        if "parent_project_id" not in project_columns:
            connection.exec_driver_sql(
                "ALTER TABLE projects ADD COLUMN parent_project_id INTEGER REFERENCES projects(id)"
            )
        if "project_manager_id" not in project_columns:
            connection.exec_driver_sql(
                "ALTER TABLE projects ADD COLUMN project_manager_id INTEGER"
            )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_projects_project_type ON projects (project_type)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_projects_parent_project_id ON projects (parent_project_id)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_projects_project_manager_id "
            "ON projects (project_manager_id)"
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
        if "auth_version" not in user_columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0"
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

@app.middleware("http")
async def secure_api_requests(request: Request, call_next):
    """Require a same-origin-only header for cookie-authenticated writes."""
    if (
        request.url.path.startswith("/api/")
        and request.method not in {"GET", "HEAD", "OPTIONS"}
        and request.cookies.get(settings.auth_cookie_name)
        and request.headers.get("X-TrackerX-Request") != "1"
    ):
        return JSONResponse(status_code=403, content={"detail": "Missing request verification header."})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "no-cache"
    return response


app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-TrackerX-Request"],
    expose_headers=["Content-Disposition", "Retry-After", "X-Preview-Truncated"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Create any missing tables. (Simple projects skip migration tooling.)"""
    settings.documents_dir.mkdir(parents=True, exist_ok=True)
    try:
        store = get_document_store()
        store.ensure_ready()
        logger.info("Document object storage backend: %s", store.backend_name)
    except Exception:
        logger.exception("Document object storage is not ready.")
        if _production:
            raise
    if settings.backup_on_startup:
        try:
            result = create_data_backup(reason="startup")
            logger.info("Verified startup data backup: %s", result["archive"])
        except FileNotFoundError:
            pass  # The first start has no database to preserve yet.
        except Exception:
            logger.exception("TrackerX could not create its startup data backup.")
    Base.metadata.create_all(bind=engine)
    _migrate_local_schema()
    with SessionLocal() as db:
        result = normalize_document_storage_paths(db)
        if result["updated"] or result["invalid"]:
            logger.info("Document path migration result: %s", result)


# Auth carries its own /auth prefix; everything else is mounted under /api.
app.include_router(auth.router, prefix="/api")
for r in (
    projects.router,
    assets.router,
    milestones.router,
    tasks.router,
    team_members.router,
    users.router,
    documents.router,
    employee_profile_files.router,
    meetings.router,
    comments.router,
    csv_import.router,
    analytics.router,
    attendance.router,
    leave_requests.router,
    gantt.router,
    support.router,
    clients.router,
    coverage.router,
    notifications.router,
):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["health"])
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.exception("Database health check failed.")
        raise HTTPException(status_code=503, detail="Database unavailable.") from exc
    return {"status": "ok", "database": "ok"}
