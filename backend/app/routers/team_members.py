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
from app.models import Project, TeamMember, User
from app.schemas.team_member import (
    EmployeeCredentialsInput,
    EmployeeCredentialsOut,
    EmployeeProjectsInput,
    TeamMemberInput,
    TeamMemberOut,
    TeamMemberUpdate,
)
from app.security import hash_password
from app.services.password_policy import validate_password
from app.services.employee_numbers import assign_employee_number
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


def _active_managed_project_names(member: TeamMember) -> list[str]:
    return [
        project.name
        for project in member.managed_projects
        if project.status not in ("completed", "archived")
    ]


def _require_no_active_leadership(member: TeamMember) -> None:
    projects = _active_managed_project_names(member)
    if projects:
        names = ", ".join(projects[:3])
        suffix = f" and {len(projects) - 3} more" if len(projects) > 3 else ""
        raise HTTPException(
            status_code=409,
            detail=f"Reassign active project leadership before changing this employee's status: {names}{suffix}.",
        )


def _require_owner_profile_control(member: TeamMember, admin: User) -> None:
    if member.user and bool(member.user.is_primary_admin) and member.user.id != admin.id:
        raise HTTPException(
            status_code=403,
            detail="Only the owner can change the owner's employee profile.",
        )


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
    return [
        team_member_out(m)
        for m in q.order_by(TeamMember.employee_number, TeamMember.id).all()
    ]


@router.get("/me", response_model=TeamMemberOut)
def get_my_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return the directory profile linked to the signed-in employee."""
    member = db.query(TeamMember).filter(TeamMember.user_id == user.id).first()
    if member is None:
        raise HTTPException(status_code=404, detail="No employee profile is linked to this login.")
    return team_member_out(member)


@router.get("/{member_id}", response_model=TeamMemberOut)
def get_member(
    member_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Management can view profiles; an employee can view their own profile."""
    member = _member_or_404(db, member_id)
    if user.role not in ("admin", "pm") and member.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only view your own employee profile.")
    return team_member_out(member)


@router.post("", response_model=TeamMemberOut, status_code=201)
def create_member(inp: TeamMemberInput, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = TeamMember(
        name=inp.name,
        name_arabic=inp.name_arabic,
        role=inp.role,
        role_description=inp.role_description,
        employment_type=inp.employment_type,
        weekly_hours=inp.weekly_hours,
        is_active=1 if inp.is_active else 0,
    )
    db.add(m)
    assign_employee_number(db, m)
    db.commit()
    db.refresh(m)
    return team_member_out(m)


@router.put("/{member_id}", response_model=TeamMemberOut)
def update_member(
    member_id: int, inp: TeamMemberUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    m = _member_or_404(db, member_id)
    _require_owner_profile_control(m, admin)
    data = inp.model_dump(exclude_unset=True)
    if "is_active" in data:
        if not data["is_active"]:
            _require_no_active_leadership(m)
        data["is_active"] = 1 if data["is_active"] else 0
    for field, value in data.items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return team_member_out(m)


@router.put("/{member_id}/projects", response_model=TeamMemberOut)
def assign_member_projects(
    member_id: int,
    inp: EmployeeProjectsInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Replace an employee's direct project assignments. Admin-only."""
    member = _member_or_404(db, member_id)
    if not bool(member.is_active):
        raise HTTPException(status_code=422, detail="Reactivate the employee before assigning projects.")
    if len(inp.project_ids) != len(set(inp.project_ids)):
        raise HTTPException(status_code=422, detail="Project assignments cannot contain duplicates.")

    projects = (
        db.query(Project)
        .filter(Project.id.in_(inp.project_ids))
        .order_by(Project.name)
        .all()
        if inp.project_ids
        else []
    )
    found_ids = {project.id for project in projects}
    missing_ids = sorted(set(inp.project_ids) - found_ids)
    if missing_ids:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown project IDs: {', '.join(str(project_id) for project_id in missing_ids)}.",
        )

    member.assigned_projects = projects
    db.commit()
    db.refresh(member)
    return team_member_out(member)


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Soft delete — keep the row so assigned tasks keep their history."""
    m = _member_or_404(db, member_id)
    _require_owner_profile_control(m, admin)
    if m.user and bool(m.user.is_primary_admin):
        raise HTTPException(status_code=422, detail="The owner cannot be deactivated.")
    _require_no_active_leadership(m)
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
    if account_role == "pm" and inp.access_level != "write":
        raise HTTPException(
            status_code=422,
            detail="Project Manager accounts require read and write permission.",
        )
    existing_role = user.role if user else None
    touches_privileged_account = account_role in ("admin", "pm") or existing_role in ("admin", "pm")
    if touches_privileged_account and not bool(admin.is_primary_admin):
        raise HTTPException(
            status_code=403,
            detail="Only the owner can manage administrator or Project Manager accounts.",
        )
    has_leadership_access = account_role == "admin" or (
        account_role == "pm" and inp.access_level == "write"
    )
    if _active_managed_project_names(member) and (
        not has_leadership_access or not inp.is_enabled
    ):
        raise HTTPException(
            status_code=409,
            detail="Reassign this employee's active projects before removing project leadership access.",
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
        try:
            validate_password(inp.temporary_password, (email, member.name))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
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
        security_changed = (
            user.email != email
            or user.role != account_role
            or user.access_level != ("write" if account_role == "admin" else inp.access_level)
            or bool(user.is_enabled) != bool(inp.is_enabled)
            or bool(inp.temporary_password)
        )
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
            try:
                validate_password(inp.temporary_password, (email, member.name))
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc))
            user.hashed_password = hash_password(inp.temporary_password)
            user.must_change_password = 1
        if security_changed:
            user.auth_version = int(user.auth_version or 0) + 1

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
