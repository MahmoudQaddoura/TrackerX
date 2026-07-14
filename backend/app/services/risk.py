"""
services/risk.py
Pure risk computation: turn a task's status, delay flag, and schedule into one
of 'on_track' | 'at_risk' | 'overdue' | 'unknown'. Ported from the reference
project's schedule-vs-progress heuristic. No DB, no framework.
"""

from __future__ import annotations

from datetime import date

# Assumed completion percentage per status, used to compare against the
# fraction of the schedule window that has already elapsed.
_ASSUMED_PROGRESS = {
    "todo": 0,
    "blocked": 20,
    "in_progress": 40,
    "in_review": 70,
    "done": 100,
}


def _parse(d: str | None) -> date | None:
    if not d:
        return None
    try:
        return date.fromisoformat(d[:10])
    except ValueError:
        return None


def task_risk(task, today: date | None = None) -> str:
    """Risk level for a single task."""
    today = today or date.today()

    if task.status == "done":
        return "on_track"
    if bool(task.is_delayed):
        return "overdue"

    start = _parse(task.start_date)
    end = _parse(task.end_date)
    if start is None or end is None or end < start:
        return "unknown"

    if today > end:
        return "overdue"

    total_days = max((end - start).days, 1)
    elapsed_days = max((today - start).days, 0)
    elapsed_pct = min(100, round(100 * elapsed_days / total_days))
    assumed_pct = _ASSUMED_PROGRESS.get(task.status, 0)

    days_left = (end - today).days
    if elapsed_pct - assumed_pct >= 25:
        return "at_risk"
    if days_left <= 3 and assumed_pct < 80:
        return "at_risk"
    if elapsed_pct - assumed_pct >= 10:
        return "at_risk"
    return "on_track"


# Ordering used to pick the "worst" risk across a set of tasks.
_SEVERITY = {"on_track": 0, "unknown": 1, "at_risk": 2, "overdue": 3}


def worst_risk(tasks, today: date | None = None) -> str:
    """Highest-severity risk among a set of tasks (milestone/project level)."""
    levels = [task_risk(t, today) for t in tasks]
    if not levels:
        return "unknown"
    return max(levels, key=lambda lvl: _SEVERITY.get(lvl, 0))
