from __future__ import annotations

"""
routers/milestones.py
Milestones nested under a project, plus by-id read/update/delete.
Dates are clamped to the parent project's window when both are set.
Reads are scoped to projects the caller can see; writes require admin/pm
and are scoped to projects the pm actually manages.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import check_project_access, get_current_user, require_manager
from app.models import Milestone, Project, User
from app.schemas.milestone import MilestoneInput, MilestoneOut, MilestoneUpdate
from app.services.serialize import milestone_out

router = APIRouter(tags=["milestones"])


def _milestone_or_404(db: Session, milestone_id: int) -> Milestone:
    ms = db.get(Milestone, milestone_id)
    if ms is None:
        raise HTTPException(status_code=404, detail="Milestone not found.")
    return ms


def _check_dates(start: str | None, end: str | None) -> None:
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")


@router.get("/projects/{project_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(
    project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    rows = (
        db.query(Milestone)
        .filter(Milestone.project_id == project_id)
        .order_by(Milestone.sort_order, Milestone.id)
        .all()
    )
    return [milestone_out(m) for m in rows]


@router.post("/projects/{project_id}/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(
    project_id: int,
    inp: MilestoneInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    _check_dates(inp.start_date, inp.end_date)
    ms = Milestone(project_id=project_id, **inp.model_dump())
    db.add(ms)
    db.commit()
    db.refresh(ms)
    return milestone_out(ms)


@router.get("/milestones/{milestone_id}", response_model=MilestoneOut)
def get_milestone(
    milestone_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    ms = _milestone_or_404(db, milestone_id)
    check_project_access(db, user, ms.project_id)
    return milestone_out(ms)


@router.put("/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: int,
    inp: MilestoneUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    ms = _milestone_or_404(db, milestone_id)
    check_project_access(db, user, ms.project_id)
    data = inp.model_dump(exclude_unset=True)
    _check_dates(data.get("start_date", ms.start_date), data.get("end_date", ms.end_date))
    for field, value in data.items():
        setattr(ms, field, value)
    db.commit()
    db.refresh(ms)
    return milestone_out(ms)


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    milestone_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager)
):
    ms = _milestone_or_404(db, milestone_id)
    check_project_access(db, user, ms.project_id)
    db.delete(ms)
    db.commit()
