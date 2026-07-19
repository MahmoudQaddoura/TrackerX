"""
routers/team_members.py
Employee directory. Admin sees everyone and has full CRUD. PM sees everyone
(read-only — cannot create, edit, or delete). Developer and client get nothing.

Delete is a soft delete (is_active -> 0) so historical task assignments survive.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import TeamMember, User
from app.schemas.team_member import TeamMemberInput, TeamMemberOut, TeamMemberUpdate
from app.services.serialize import team_member_out

router = APIRouter(prefix="/team-members", tags=["employees"])


def _member_or_404(db: Session, member_id: int) -> TeamMember:
    m = db.get(TeamMember, member_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return m


@router.get("", response_model=list[TeamMemberOut])
def list_members(
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admin and PM can see the full employee list. Others get nothing."""
    if user.role not in ("admin", "pm"):
        return []
    q = db.query(TeamMember)
    if active_only:
        q = q.filter(TeamMember.is_active == 1)
    return [team_member_out(m) for m in q.order_by(TeamMember.name).all()]


@router.get("/{member_id}", response_model=TeamMemberOut)
def get_member(
    member_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admin and PM can view an employee's profile (projects, workload)."""
    if user.role not in ("admin", "pm"):
        raise HTTPException(status_code=403, detail="Only admins and PMs can view employee profiles.")
    return team_member_out(_member_or_404(db, member_id))


@router.post("", response_model=TeamMemberOut, status_code=201)
def create_member(inp: TeamMemberInput, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = TeamMember(
        name=inp.name, role=inp.role, is_active=1 if inp.is_active else 0
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return team_member_out(m)


@router.put("/{member_id}", response_model=TeamMemberOut)
def update_member(
    member_id: int, inp: TeamMemberUpdate, db: Session = Depends(get_db), _=Depends(require_admin)
):
    m = _member_or_404(db, member_id)
    data = inp.model_dump(exclude_unset=True)
    if "is_active" in data:
        data["is_active"] = 1 if data["is_active"] else 0
    for field, value in data.items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return team_member_out(m)


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Soft delete — keep the row so assigned tasks keep their history."""
    m = _member_or_404(db, member_id)
    m.is_active = 0
    db.commit()
