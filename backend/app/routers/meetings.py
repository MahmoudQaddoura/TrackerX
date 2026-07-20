from __future__ import annotations

"""
routers/meetings.py
Sprint / client meeting minutes under a project. Reads are scoped to
projects the caller can see; writes require admin/pm and are scoped to
projects the pm actually manages.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import check_project_access, get_current_user, require_manager
from app.models import Meeting, Project, User
from app.models.meeting import MEETING_TYPES
from app.schemas.meeting import MeetingInput, MeetingOut, MeetingUpdate

router = APIRouter(tags=["meetings"])


def _meeting_or_404(db: Session, meeting_id: int) -> Meeting:
    m = db.get(Meeting, meeting_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    return m


def _check_type(mtype: str | None) -> None:
    if mtype is not None and mtype not in MEETING_TYPES:
        raise HTTPException(status_code=422, detail="meeting_type must be 'sprint' or 'client'.")


@router.get("/projects/{project_id}/meetings", response_model=list[MeetingOut])
def list_meetings(
    project_id: int,
    meeting_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    q = db.query(Meeting).filter(Meeting.project_id == project_id)
    if meeting_type:
        q = q.filter(Meeting.meeting_type == meeting_type)
    return q.order_by(Meeting.meeting_date.desc(), Meeting.id.desc()).all()


@router.post("/projects/{project_id}/meetings", response_model=MeetingOut, status_code=201)
def create_meeting(
    project_id: int,
    inp: MeetingInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    _check_type(inp.meeting_type)
    meeting = Meeting(project_id=project_id, **inp.model_dump())
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.get("/meetings/{meeting_id}", response_model=MeetingOut)
def get_meeting(
    meeting_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    m = _meeting_or_404(db, meeting_id)
    check_project_access(db, user, m.project_id)
    return m


@router.put("/meetings/{meeting_id}", response_model=MeetingOut)
def update_meeting(
    meeting_id: int,
    inp: MeetingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    meeting = _meeting_or_404(db, meeting_id)
    check_project_access(db, user, meeting.project_id)
    _check_type(inp.meeting_type)
    for field, value in inp.model_dump(exclude_unset=True).items():
        setattr(meeting, field, value)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(
    meeting_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager)
):
    meeting = _meeting_or_404(db, meeting_id)
    check_project_access(db, user, meeting.project_id)
    db.delete(meeting)
    db.commit()
