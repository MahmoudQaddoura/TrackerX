from __future__ import annotations

"""Milestone-first schedule rows for the project Gantt workspace."""

from datetime import date, datetime, timedelta
from math import ceil

from fastapi import APIRouter, Depends

from app.deps import get_current_user, require_project_access
from app.models import Project, User
from app.schemas.gantt import GanttTask

router = APIRouter(tags=["gantt"])

_PROGRESS = {
    "todo": 0,
    "blocked": 10,
    "in_progress": 50,
    "in_review": 80,
    "done": 100,
}


def _parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        except ValueError:
            return None


def _add_days(start: date, days: float | int | None) -> date:
    duration = max(1, ceil(float(days or 1)))
    return start + timedelta(days=duration)


def _task_assignees(task) -> list[str]:
    names = [member.name for member in task.assigned_members]
    if not names and task.assigned_member:
        names.append(task.assigned_member.name)
    return names


@router.get("/projects/{project_id}/gantt", response_model=list[GanttTask])
def project_gantt(
    project: Project = Depends(require_project_access),
    user: User = Depends(get_current_user),
):
    """Return milestone parents followed by their task schedule rows."""
    if project.project_type == "maintenance_support":
        return []
    anchor = (
        _parse_date(project.start_date)
        or _parse_date(project.created_at)
        or date.today()
    )
    current_date = anchor
    rows: list[GanttTask] = []

    delivery_milestones = [
        milestone for milestone in project.milestones if milestone.workstream == "project"
    ]
    for milestone in sorted(delivery_milestones, key=lambda item: (item.sort_order, item.id)):
        tasks = sorted(milestone.tasks, key=lambda item: (item.sort_order, item.id))
        milestone_start_input = _parse_date(milestone.start_date)
        milestone_end_input = _parse_date(milestone.end_date)
        explicit_task_starts = [
            parsed
            for task in tasks
            if (parsed := _parse_date(task.start_date)) is not None
        ]
        schedule_start = milestone_start_input or (
            min(explicit_task_starts) if explicit_task_starts else current_date
        )
        cursor = schedule_start
        task_rows: list[GanttTask] = []
        task_starts: list[date] = []
        task_ends: list[date] = []

        for task in tasks:
            explicit_start = _parse_date(task.start_date)
            explicit_end = _parse_date(task.end_date)
            is_auto = explicit_start is None or explicit_end is None
            task_start = explicit_start or cursor
            task_end = explicit_end or _add_days(task_start, task.est_days)
            if task_end < task_start:
                task_end = task_start
            cursor = max(cursor, task_end)
            task_starts.append(task_start)
            task_ends.append(task_end)

            classes = ["gantt-task-bar", f"gantt-task-{task.status.replace('_', '-')}"]
            if bool(task.is_delayed):
                classes.append("gantt-delayed-bar")
            if is_auto:
                classes.append("gantt-auto-bar")

            task_rows.append(
                GanttTask(
                    id=f"task-{task.id}",
                    name=f"↳ {task.title}",
                    start=task_start.isoformat(),
                    end=task_end.isoformat(),
                    progress=_PROGRESS.get(task.status, 0),
                    custom_class=" ".join(classes),
                    entity_type="task",
                    milestone_id=milestone.id,
                    milestone_name=milestone.title,
                    workstream=milestone.workstream,
                    task_id=task.id,
                    status=task.status,
                    is_delayed=bool(task.is_delayed),
                    is_auto_scheduled=is_auto,
                    assignee_names=_task_assignees(task) if user.role != "client" else [],
                )
            )

        effective_start = min(
            [value for value in [milestone_start_input, *task_starts] if value is not None],
            default=schedule_start,
        )
        effective_end = max(
            [value for value in [milestone_end_input, *task_ends] if value is not None],
            default=_add_days(effective_start, 1),
        )
        if effective_end < effective_start:
            effective_end = effective_start
        total_tasks = len(tasks)
        done_tasks = sum(1 for task in tasks if task.status == "done")
        progress = round(done_tasks / total_tasks * 100) if total_tasks else 0
        milestone_delayed = any(bool(task.is_delayed) for task in tasks)
        milestone_classes = [
            "gantt-milestone-bar",
            f"gantt-milestone-{milestone.workstream}",
        ]
        if milestone_delayed:
            milestone_classes.append("gantt-delayed-milestone")

        rows.append(
            GanttTask(
                id=f"milestone-{milestone.id}",
                name=f"◆ {milestone.title}",
                start=effective_start.isoformat(),
                end=effective_end.isoformat(),
                progress=progress,
                custom_class=" ".join(milestone_classes),
                entity_type="milestone",
                milestone_id=milestone.id,
                milestone_name=milestone.title,
                workstream=milestone.workstream,
                status=None,
                is_delayed=milestone_delayed,
                is_auto_scheduled=milestone_start_input is None or milestone_end_input is None,
                assignee_names=[],
            )
        )
        rows.extend(task_rows)
        current_date = max(current_date, effective_end)

    return rows
