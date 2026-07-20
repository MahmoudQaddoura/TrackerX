from __future__ import annotations

"""
routers/gantt.py
Return a project's tasks shaped for frappe-gantt. Tasks that have explicit
start_date/end_date are used as-is. Tasks without dates are auto-scheduled:
milestones run sequentially, and within each milestone tasks are stacked in
sort_order, each lasting its est_days (default 1). This way CSV-imported
projects get a sensible timeline out of the box without manual date entry.
"""

from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends

from app.deps import require_project_access
from app.models import Project
from app.schemas.gantt import GanttTask

router = APIRouter(tags=["gantt"])

# Progress shown on the bar per status.
_PROGRESS = {
    "todo": 0,
    "blocked": 10,
    "in_progress": 50,
    "in_review": 80,
    "done": 100,
}


def _parse_date(raw: str | None) -> date | None:
    """Try an ISO date (or datetime) string. Returns None on failure."""
    if not raw:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _fmt(d: date) -> str:
    return d.isoformat()


def _add_workdays(start: date, days: int) -> date:
    """Add calendar days (simple — no weekend skipping needed for Gantt)."""
    return start + timedelta(days=max(days, 1))


@router.get("/projects/{project_id}/gantt", response_model=list[GanttTask])
def project_gantt(project: Project = Depends(require_project_access)):
    anchor = _parse_date(project.created_at) or date.today()

    # First pass: collect all tasks, noting which have explicit dates.
    all_tasks: list[dict] = []
    any_explicit = False
    for m in sorted(project.milestones, key=lambda x: x.sort_order):
        for t in sorted(m.tasks, key=lambda x: x.sort_order):
            explicit = bool(t.start_date and t.end_date)
            if explicit:
                any_explicit = True
            all_tasks.append({
                "id": f"task-{t.id}",
                "name": t.title,
                "start": t.start_date,
                "end": t.end_date,
                "explicit": explicit,
                "status": t.status,
                "est_days": t.est_days,
                "delayed": bool(t.is_delayed),
            })

    # If every task has explicit dates, render them as-is (respect manual scheduling).
    if any_explicit and all(t["explicit"] for t in all_tasks):
        bars: list[GanttTask] = []
        for t in all_tasks:
            start_str = _parse_date(t["start"])
            end_str = _parse_date(t["end"])
            if not start_str or not end_str:
                continue
            bars.append(
                GanttTask(
                    id=t["id"],
                    name=t["name"],
                    start=_fmt(start_str),
                    end=_fmt(end_str),
                    progress=_PROGRESS.get(t["status"], 0),
                    custom_class="gantt-delayed-bar" if t["delayed"] else "gantt-normal-bar",
                )
            )
        return bars

    # Auto-schedule: milestones run sequentially; tasks within each milestone
    # are stacked in order, each lasting its est_days (default 1 day).
    bars: list[GanttTask] = []
    current_date = anchor

    # Group tasks by milestone (already in order from the sorted query above).
    ms_groups: list[list[dict]] = []
    current_ms: list[dict] = []
    prev_ms_id = None
    for t in all_tasks:
        # Infer milestone grouping from task id prefix — fragile but works here.
        # Better: group from the original query loop directly.
        pass

    # Better approach: iterate milestones directly.
    for m in sorted(project.milestones, key=lambda x: x.sort_order):
        ms_tasks = sorted(m.tasks, key=lambda x: x.sort_order)
        if not ms_tasks:
            continue

        # If this milestone has ANY explicitly-dated task, honour those dates
        # and place non-dated tasks relative to the milestone's earliest date.
        explicit_dates = [(t.start_date, t.end_date) for t in ms_tasks if t.start_date and t.end_date]
        if explicit_dates:
            # Use the earliest explicit start as the milestone anchor.
            earliest = min(
                _parse_date(s) for s, e in explicit_dates if _parse_date(s)
            )
            # Still schedule undated tasks sequentially after the earliest dated one.
            cursor = earliest
        else:
            cursor = current_date

        for t in ms_tasks:
            if t.start_date and t.end_date:
                s = _parse_date(t.start_date)
                e = _parse_date(t.end_date)
                if s and e:
                    bars.append(
                        GanttTask(
                            id=f"task-{t.id}",
                            name=t.title,
                            start=_fmt(s),
                            end=_fmt(e),
                            progress=_PROGRESS.get(t.status, 0),
                            custom_class="gantt-delayed-bar" if t.is_delayed else "gantt-normal-bar",
                        )
                    )
                    # Advance cursor past this explicit task (don't overlap).
                    if e > cursor:
                        cursor = e
                continue

            # Auto-schedule: use est_days, default 1 day.
            days = int(t.est_days) if t.est_days else 1
            task_end = _add_workdays(cursor, days)
            bars.append(
                GanttTask(
                    id=f"task-{t.id}",
                    name=t.title,
                    start=_fmt(cursor),
                    end=_fmt(task_end),
                    progress=_PROGRESS.get(t.status, 0),
                    custom_class="gantt-delayed-bar" if t.is_delayed else "gantt-normal-bar",
                )
            )
            cursor = task_end

        # After each milestone, the next one picks up where we left off.
        if not explicit_dates:
            current_date = cursor

    return bars
