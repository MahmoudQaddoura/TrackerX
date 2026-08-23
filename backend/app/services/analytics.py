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


def _task_members(task) -> list:
    """Return the multi-assignee list, with the legacy primary assignment as fallback."""
    members = list(getattr(task, "assigned_members", []) or [])
    primary = getattr(task, "assigned_member", None)
    if not members and primary is not None:
        members = [primary]
    return members


def delivery_map(projects) -> list[dict]:
    """Actionable per-project status, assignee load, and priority-task roll-up."""
    rows = []
    delivery_projects = [
        project
        for project in projects
        if getattr(project, "project_type", "actual_project") == "actual_project"
        and project.status != "archived"
    ]

    for project in delivery_projects:
        tasks = prog.project_tasks(project)
        rollup = prog.rollup(tasks)
        counts = {status: 0 for status in TASK_STATUSES}
        assignee_load: dict[int, dict] = {}
        unassigned = 0

        milestone_by_task = {
            task.id: milestone
            for milestone in project.milestones
            if milestone.workstream == "project"
            for task in milestone.tasks
        }

        for task in tasks:
            counts[task.status] = counts.get(task.status, 0) + 1
            members = _task_members(task)
            if task.status != "done" and not members:
                unassigned += 1
            for member in members:
                load = assignee_load.setdefault(
                    member.id,
                    {
                        "member_id": member.id,
                        "name": member.name,
                        "total_tasks": 0,
                        "open_tasks": 0,
                        "delayed_tasks": 0,
                    },
                )
                load["total_tasks"] += 1
                if task.status != "done":
                    load["open_tasks"] += 1
                if _is_delayed(task):
                    load["delayed_tasks"] += 1

        attention_candidates = [task for task in tasks if task.status != "done"]
        attention_candidates.sort(
            key=lambda task: (
                0 if _is_delayed(task) else 1,
                0 if task.status == "blocked" else 1,
                task.end_date or "9999-12-31",
                task.id,
            )
        )
        attention_tasks = []
        for task in attention_candidates[:5]:
            milestone = milestone_by_task[task.id]
            attention_tasks.append(
                {
                    "task_id": task.id,
                    "title": task.title,
                    "milestone_id": milestone.id,
                    "milestone_title": milestone.title,
                    "status": task.status,
                    "is_delayed": _is_delayed(task),
                    "end_date": task.end_date,
                    "assignee_names": [member.name for member in _task_members(task)],
                }
            )

        rows.append(
            {
                "project_id": project.id,
                "project_name": project.name,
                "project_status": project.status,
                "project_manager_name": getattr(
                    getattr(project, "project_manager", None), "name", None
                ),
                "progress_pct": rollup["progress_pct"],
                "total_tasks": rollup["total_tasks"],
                "done_tasks": rollup["done_tasks"],
                "delayed_tasks": sum(1 for task in tasks if _is_delayed(task)),
                "blocked_tasks": counts["blocked"],
                "unassigned_tasks": unassigned,
                "status_counts": counts,
                "assignees": sorted(
                    assignee_load.values(),
                    key=lambda item: (-item["delayed_tasks"], -item["open_tasks"], item["name"]),
                ),
                "attention_tasks": attention_tasks,
            }
        )

    return sorted(
        rows,
        key=lambda item: (
            -item["delayed_tasks"],
            -item["blocked_tasks"],
            item["progress_pct"],
            item["project_name"],
        ),
    )
