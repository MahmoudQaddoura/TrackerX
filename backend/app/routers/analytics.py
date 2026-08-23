from __future__ import annotations

"""
routers/analytics.py
Read-only dashboard endpoints. Each accepts an optional ?project_id= to scope
to a single project; without it they aggregate over every project the
caller can see (the whole portfolio for admin, only their own for
pm/developer/client).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import check_project_access, get_accessible_project_ids, get_current_user
from app.models import Project, User
from app.schemas.analytics import (
    DeliveryMapProject,
    DelayedTaskItem,
    ProjectTimelineItem,
    StatusBreakdownItem,
    SummaryOut,
)
from app.services import analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _scope(db: Session, user: User, project_id: int | None) -> list[Project]:
    """Return the project(s) to aggregate over, filtered to what `user` can see."""
    if project_id is not None:
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found.")
        check_project_access(db, user, project_id)
        return [project]

    ids = get_accessible_project_ids(user, db)
    q = db.query(Project)
    if ids is not None:
        if not ids:
            return []
        q = q.filter(Project.id.in_(ids))
    return q.all()


@router.get("/summary", response_model=SummaryOut)
def get_summary(
    project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return analytics.summary(_scope(db, user, project_id))


@router.get("/status-breakdown", response_model=list[StatusBreakdownItem])
def get_status_breakdown(
    project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return analytics.status_breakdown(_scope(db, user, project_id))


@router.get("/project-timelines", response_model=list[ProjectTimelineItem])
def get_project_timelines(
    project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return analytics.project_timelines(_scope(db, user, project_id))


@router.get("/delayed-tasks", response_model=list[DelayedTaskItem])
def get_delayed_tasks(
    project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    rows = analytics.delayed_tasks(_scope(db, user, project_id))
    if user.role == "client":
        for row in rows:
            row["owner"] = None
    return rows


@router.get("/delivery-map", response_model=list[DeliveryMapProject])
def get_delivery_map(
    project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    rows = analytics.delivery_map(_scope(db, user, project_id))
    if user.role == "client":
        for row in rows:
            row["project_manager_name"] = None
            row["assignees"] = []
            for task in row["attention_tasks"]:
                task["assignee_names"] = []
    return rows
