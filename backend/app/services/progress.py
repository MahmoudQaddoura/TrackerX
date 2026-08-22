"""
services/progress.py
Pure progress roll-ups. No DB queries, no framework — takes model instances
(or anything with .status / .is_delayed) and returns plain numbers.
"""

from __future__ import annotations

from typing import Iterable

DONE_STATUS = "done"


def _is_delayed(task) -> bool:
    return bool(task.is_delayed)


def progress_pct(tasks: Iterable) -> int:
    """Percentage of tasks that are done (0–100, integer)."""
    tasks = list(tasks)
    if not tasks:
        return 0
    done = sum(1 for t in tasks if t.status == DONE_STATUS)
    return round(100 * done / len(tasks))


def rollup(tasks: Iterable) -> dict:
    """Summary counts for a set of tasks (used by milestones and projects)."""
    tasks = list(tasks)
    done = sum(1 for t in tasks if t.status == DONE_STATUS)
    delayed = sum(1 for t in tasks if _is_delayed(t))
    return {
        "total_tasks": len(tasks),
        "done_tasks": done,
        "delayed_tasks": delayed,
        "progress_pct": progress_pct(tasks),
        "is_delayed": delayed > 0,
    }


def project_tasks(project) -> list:
    """Flatten every task across a project's milestones."""
    if getattr(project, "project_type", "actual_project") == "maintenance_support":
        return []
    return [t for m in project.milestones if m.workstream == "project" for t in m.tasks]
