"""
services/analytics.py
Dashboard aggregations computed over the loaded ORM objects. One purpose:
turn projects/tasks into the numbers the dashboard charts and tables need.
Accepts an optional project filter so the same functions power both the
portfolio dashboard and a single-project dashboard.
"""

from __future__ import annotations

from datetime import date

from app.models.task import TASK_STATUSES
from app.services import progress as prog
from app.services.risk import task_risk


def _all_tasks(projects) -> list:
    return [t for p in projects for m in p.milestones for t in m.tasks]


def _is_delayed(task) -> bool:
    """Treat an explicit delay or an incomplete past-due task as an alert."""
    return bool(task.is_delayed) or task_risk(task) == "overdue"


def _days_overdue(task) -> int | None:
    if not task.end_date or task.status == "done":
        return None
    try:
        due = date.fromisoformat(task.end_date[:10])
    except ValueError:
        return None
    return max((date.today() - due).days, 0)


def summary(projects) -> dict:
    """KPI tiles: project/task counts, overall progress, delayed count."""
    tasks = _all_tasks(projects)
    r = prog.rollup(tasks)
    return {
        "total_projects": len(projects),
        "active_projects": sum(1 for p in projects if p.status == "active"),
        "total_tasks": r["total_tasks"],
        "done_tasks": r["done_tasks"],
        "progress_pct": r["progress_pct"],
        "delayed_tasks": sum(1 for task in tasks if _is_delayed(task)),
    }


def status_breakdown(projects) -> list[dict]:
    """Task count per status, in a fixed order (drives the bar chart)."""
    counts = {s: 0 for s in TASK_STATUSES}
    for t in _all_tasks(projects):
        counts[t.status] = counts.get(t.status, 0) + 1
    return [{"status": s, "count": counts[s]} for s in TASK_STATUSES]


def project_timelines(projects) -> list[dict]:
    """Per-project progress %, for the horizontal progress bar chart."""
    out = []
    for p in projects:
        tasks = prog.project_tasks(p)
        r = prog.rollup(tasks)
        out.append(
            {
                "project_id": p.id,
                "name": p.name,
                "progress_pct": r["progress_pct"],
                "is_delayed": any(_is_delayed(task) for task in tasks),
            }
        )
    return out


def delayed_tasks(projects) -> list[dict]:
    """Flat list of delayed tasks with their context, for the delays table."""
    out = []
    for p in projects:
        for m in p.milestones:
            for t in m.tasks:
                if _is_delayed(t):
                    out.append(
                        {
                            "task_id": t.id,
                            "task_title": t.title,
                            "project_id": p.id,
                            "project_name": p.name,
                            "milestone_id": m.id,
                            "milestone_title": m.title,
                            "owner": ", ".join(member.name for member in t.assigned_members) or None,
                            "delay_cause": t.delay_cause,
                            "delay_comment": t.delay_comment,
                            "end_date": t.end_date,
                            "trigger_type": "manual" if bool(t.is_delayed) else "schedule",
                            "days_overdue": _days_overdue(t),
                        }
                    )
    return sorted(
        out,
        key=lambda item: (item["days_overdue"] or 0, item["task_id"]),
        reverse=True,
    )
