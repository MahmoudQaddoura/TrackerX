from __future__ import annotations

"""
routers/team_members.py
Employee directory. Admin sees everyone and has full CRUD. PM sees everyone
(read-only — cannot create, edit, or delete). Developer and client get nothing.

Delete is a soft delete (is_active -> 0) so historical task assignments survive.
A task-delegation endpoint lets admins reassign a departing member's pending
tasks to another active employee.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import TeamMember, User
from app.schemas.team_member import (
    EmployeeCredentialsInput,
    EmployeeCredentialsOut,
    TeamMemberInput,
    TeamMemberOut,
    TeamMemberUpdate,
)
from app.security import hash_password
from app.services.serialize import team_member_out

router = APIRouter(prefix="/team-members", tags=["employees"])

EMPLOYEE_ACCOUNT_ROLES = {"admin", "pm", "developer"}


class DelegateTasksInput(BaseModel):
    """Reassign all non-done tasks from one member to another."""
    to_member_id: int = Field(..., description="ID of the employee who will receive the tasks.")


class DelegateTasksOut(BaseModel):
    """Result of a task delegation operation."""
    from_member_id: int
    from_member_name: str
    to_member_id: int
    to_member_name: str
    tasks_reassigned: int


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
    if m.user and m.user.role != "admin":
        m.user.is_enabled = 0
    db.commit()


@router.put("/{member_id}/credentials", response_model=EmployeeCredentialsOut)
def provision_credentials(
    member_id: int,
    inp: EmployeeCredentialsInput,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create, reset, enable, or permission an employee's linked login."""
    member = _member_or_404(db, member_id)
    if inp.access_level not in ("read", "write"):
        raise HTTPException(status_code=422, detail="Access level must be 'read' or 'write'.")
    if inp.account_role is not None and inp.account_role not in EMPLOYEE_ACCOUNT_ROLES:
        raise HTTPException(
            status_code=422,
            detail="Account role must be admin, pm, or developer.",
        )

    email = inp.email.lower()
    duplicate = db.query(User).filter(func.lower(User.email) == email).first()
    if duplicate is not None and duplicate.id != member.user_id:
        raise HTTPException(status_code=409, detail="That email is already used by another account.")

    user = member.user
    account_role = inp.account_role or (user.role if user else "developer")
    existing_role = user.role if user else None
    changes_privileged_role = account_role != existing_role and (
        account_role in ("admin", "pm") or existing_role in ("admin", "pm")
    )
    if changes_privileged_role and not bool(admin.is_primary_admin):
        raise HTTPException(
            status_code=403,
            detail="Only the primary administrator can assign administrator or project-manager roles.",
        )
    if user and bool(user.is_primary_admin) and (
        account_role != "admin" or not inp.is_enabled
    ):
        raise HTTPException(
            status_code=422,
            detail="The primary administrator cannot be demoted or disabled.",
        )
    if user is None:
        if not inp.temporary_password:
            raise HTTPException(status_code=422, detail="A temporary password is required for a new login.")
        user = User(
            email=email,
            full_name=member.name,
            role=account_role,
            access_level="write" if account_role == "admin" else inp.access_level,
            is_enabled=1 if inp.is_enabled else 0,
            must_change_password=1,
            hashed_password=hash_password(inp.temporary_password),
        )
        db.add(user)
        db.flush()
        member.user_id = user.id
    else:
        if user.role == "admin" and (account_role != "admin" or not inp.is_enabled):
            other_enabled_admins = (
                db.query(User)
                .filter(User.role == "admin", User.is_enabled == 1, User.id != user.id)
                .count()
            )
            if other_enabled_admins == 0:
                raise HTTPException(
                    status_code=422,
                    detail="TrackerX must keep at least one enabled administrator.",
                )
        user.email = email
        user.full_name = member.name
        user.role = account_role
        user.access_level = "write" if account_role == "admin" else inp.access_level
        user.is_enabled = 1 if inp.is_enabled else 0
        if inp.temporary_password:
            user.hashed_password = hash_password(inp.temporary_password)
            user.must_change_password = 1

    db.commit()
    db.refresh(user)
    return EmployeeCredentialsOut(
        user_id=user.id,
        email=user.email,
        account_role=user.role,
        access_level="write" if user.role == "admin" else user.access_level,
        is_enabled=bool(user.is_enabled),
    )


@router.post("/{member_id}/delegate-tasks", response_model=DelegateTasksOut)
def delegate_tasks(
    member_id: int,
    inp: DelegateTasksInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Reassign all non-done tasks from a (usually deactivated) member to another
    active employee.  Completed tasks are left untouched so historical attribution
    is preserved.
    """
    from_member = _member_or_404(db, member_id)
    to_member = _member_or_404(db, inp.to_member_id)

    if from_member.id == to_member.id:
        raise HTTPException(status_code=422, detail="Cannot delegate tasks to the same employee.")

    # Replace the source employee on every pending multi-assignee task. Other
    # assignees remain attached to the task.
    tasks = [task for task in from_member.assigned_tasks if task.status != "done"]

    count = 0
    for t in tasks:
        members = [member for member in t.assigned_members if member.id != from_member.id]
        if all(member.id != to_member.id for member in members):
            members.append(to_member)
        t.assigned_members = members
        t.assigned_member_id = members[0].id if members else None
        count += 1

    db.commit()

    return DelegateTasksOut(
        from_member_id=from_member.id,
        from_member_name=from_member.name,
        to_member_id=to_member.id,
        to_member_name=to_member.name,
        tasks_reassigned=count,
    )
