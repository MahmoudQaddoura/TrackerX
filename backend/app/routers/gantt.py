"""
routers/gantt.py
Return a project's tasks shaped for frappe-gantt. Tasks without both dates are
skipped (a bar needs a start and an end). Progress is inferred from status;
delayed tasks get a custom class so the frontend can colour them red.
"""

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


@router.get("/projects/{project_id}/gantt", response_model=list[GanttTask])
def project_gantt(project: Project = Depends(require_project_access)):
    bars: list[GanttTask] = []
    for m in project.milestones:
        for t in m.tasks:
            if not t.start_date or not t.end_date:
                continue
            delayed = bool(t.is_delayed)
            bars.append(
                GanttTask(
                    id=f"task-{t.id}",
                    name=t.title,
                    start=t.start_date[:10],
                    end=t.end_date[:10],
                    progress=_PROGRESS.get(t.status, 0),
                    custom_class="gantt-delayed-bar" if delayed else "gantt-normal-bar",
                )
            )
    return bars
