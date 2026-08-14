"""
services/analytics.py
Dashboard aggregations computed over the loaded ORM objects. One purpose:
turn projects/tasks into the numbers the dashboard charts and tables need.
Accepts an optional project filter so the same functions power both the
portfolio dashboard and a single-project dashboard.
"""

from __future__ import annotations

from app.models.task import TASK_STATUSES
from app.services import progress as prog


def _all_tasks(projects) -> list:
    return [t for p in projects for m in p.milestones for t in m.tasks]


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
        "delayed_tasks": r["delayed_tasks"],
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
                "is_delayed": r["is_delayed"],
            }
        )
    return out


def delayed_tasks(projects) -> list[dict]:
    """Flat list of delayed tasks with their context, for the delays table."""
    out = []
    for p in projects:
        for m in p.milestones:
            for t in m.tasks:
                if bool(t.is_delayed) or t.status == "delayed":
                    out.append(
                        {
                            "task_id": t.id,
                            "task_title": t.title,
                            "project_id": p.id,
                            "project_name": p.name,
                            "milestone_title": m.title,
                            "owner": ", ".join(member.name for member in t.assigned_members) or None,
                            "delay_cause": t.delay_cause,
                            "delay_comment": t.delay_comment,
                            "end_date": t.end_date,
                        }
                    )
    return out
