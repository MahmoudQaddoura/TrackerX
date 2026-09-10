from __future__ import annotations

"""Database readiness checks shared by startup validation and health probes."""

from sqlalchemy import Engine, inspect, text
from sqlalchemy.orm import Session


CORE_TABLES = frozenset({"users", "projects", "milestones", "tasks", "team_members"})
REQUIRED_TABLES = frozenset(
    {
        "asset_connections",
        "asset_ports",
        "assets",
        "attendance_records",
        "client_profiles",
        "client_report_shares",
        "comments",
        "documents",
        "employee_profile_files",
        "leave_coverage_offers",
        "leave_requests",
        "meetings",
        "milestones",
        "notifications",
        "proactive_report_assignees",
        "proactive_service_reports",
        "project_clients",
        "projects",
        "support_incident_assignees",
        "support_incidents",
        "task_assignees",
        "tasks",
        "team_member_projects",
        "team_members",
        "users",
    }
)


class ReadinessError(RuntimeError):
    """Raised when TrackerX cannot safely serve application traffic."""


def validate_existing_production_database(bind: Engine, *, production: bool) -> None:
    """Refuse to migrate an empty or structurally damaged production database."""
    if not production:
        return
    tables = set(inspect(bind).get_table_names())
    missing = CORE_TABLES - tables
    if missing:
        names = ", ".join(sorted(missing))
        raise ReadinessError(
            "Production database is missing core tables "
            f"({names}). Refusing automatic initialization; restore a verified backup."
        )


def check_database_readiness(
    db: Session,
    *,
    require_users: bool,
    run_integrity_check: bool = True,
) -> dict[str, str]:
    """Validate connectivity, complete schema, data presence, and SQLite integrity."""
    bind = db.get_bind()
    db.execute(text("SELECT 1"))
    tables = set(inspect(bind).get_table_names())
    missing = REQUIRED_TABLES - tables
    if missing:
        names = ", ".join(sorted(missing))
        raise ReadinessError(f"Database schema is incomplete; missing tables: {names}.")

    if require_users:
        user_count = int(db.execute(text("SELECT COUNT(*) FROM users")).scalar_one())
        if user_count < 1:
            raise ReadinessError("Production database contains no user accounts.")

    if run_integrity_check and bind.dialect.name == "sqlite":
        result = str(db.execute(text("PRAGMA quick_check")).scalar_one())
        if result != "ok":
            raise ReadinessError(f"SQLite quick check failed: {result}")

    return {"database": "ok", "schema": "ok", "integrity": "ok"}
