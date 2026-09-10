from __future__ import annotations

"""
routers/projects.py
Project CRUD. Reads are scoped per role (admin sees everything; pm/developer
see only projects their team is on; client sees only their own project(s)).
Creating/deleting a project is admin-only (project <-> team assignment is
managed separately via the teams router); updating core fields (dates,
status, description) is open to admin or the pm managing that project.
Every response is shaped by services/serialize.project_out (computed roll-ups).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from urllib.parse import urlparse

from app.db import get_db
from app.deps import (
    check_project_manage_access,
    get_accessible_project_ids,
    get_current_user,
    require_admin,
    require_primary_admin,
    require_project_access,
    require_project_manage_access,
)
from app.models import Milestone, Project, ProactiveServiceReport, Task, TeamMember, User, task_assignees
from app.models.support import PROACTIVE_CATEGORY_TEMPLATES
from app.schemas.project import (
    ProjectInput,
    ProjectManagerInput,
    ProjectTeamInput,
    ProjectOut,
    ProjectUpdate,
    STATUS_VALUES,
    TYPE_VALUES,
)
from app.services.serialize import project_out
from app.services.serialize import team_member_out
from app.services.notifications import notify_members

router = APIRouter(tags=["projects"])


def _validate(
    inp: ProjectInput | ProjectUpdate,
    db: Session,
    existing: Project | None = None,
) -> None:
    if inp.status is not None and inp.status not in STATUS_VALUES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{inp.status}'.")
    if inp.start_date and inp.end_date and inp.start_date > inp.end_date:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")
    github_repo_url = (
        inp.github_repo_url
        if "github_repo_url" in inp.model_fields_set
        else existing.github_repo_url if existing else None
    )
    if github_repo_url:
        parsed = urlparse(github_repo_url)
        if parsed.scheme != "https" or parsed.hostname not in {"github.com", "www.github.com"}:
            raise HTTPException(status_code=422, detail="GitHub repository must use an https://github.com URL.")
    project_type = inp.project_type or (existing.project_type if existing else "actual_project")
    if project_type not in TYPE_VALUES:
        raise HTTPException(status_code=422, detail=f"Invalid project type '{project_type}'.")
    if existing and inp.project_type and inp.project_type != existing.project_type:
        raise HTTPException(status_code=422, detail="Project type cannot be changed after creation.")
    parent_project_id = (
        inp.parent_project_id
        if "parent_project_id" in inp.model_fields_set
        else existing.parent_project_id if existing else None
    )
    if project_type == "actual_project" and parent_project_id is not None:
        raise HTTPException(status_code=422, detail="An actual project cannot link to another project.")
    if parent_project_id is not None:
        parent = db.get(Project, parent_project_id)
        if parent is None:
            raise HTTPException(status_code=422, detail="The linked actual project no longer exists.")
        if parent.project_type != "actual_project":
            raise HTTPException(status_code=422, detail="Maintenance & Support can link only to an actual project.")
        if existing and parent.id == existing.id:
            raise HTTPException(status_code=422, detail="A project cannot link to itself.")


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = get_accessible_project_ids(user, db)
    q = db.query(Project)
    if ids is not None:
        if not ids:
            return []
        q = q.filter(Project.id.in_(ids))
    projects = q.order_by(Project.created_at.desc()).all()
    return [project_out(p) for p in projects]


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(
    inp: ProjectInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    _validate(inp, db)
    project = Project(**inp.model_dump())
    db.add(project)
    db.flush()
    if project.project_type == "maintenance_support":
        for category, title in PROACTIVE_CATEGORY_TEMPLATES:
            db.add(
                ProactiveServiceReport(
                    project_id=project.id,
                    category=category,
                    title=title,
                    status="pending",
                    created_by_id=user.id,
                )
            )
    db.commit()
    db.refresh(project)
    return project_out(project)


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project: Project = Depends(require_project_access)):
    return project_out(project)


@router.put("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    inp: ProjectUpdate, db: Session = Depends(get_db), project: Project = Depends(require_project_manage_access)
):
    _validate(inp, db, project)
    for field, value in inp.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project_out(project)


@router.put("/projects/{project_id}/project-manager", response_model=ProjectOut)
def update_project_manager(
    project_id: int,
    inp: ProjectManagerInput,
    db: Session = Depends(get_db),
    _owner: User = Depends(require_primary_admin),
):
    """Assign one active, privileged employee as the project's lead. Owner-only."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    manager = db.get(TeamMember, inp.project_manager_id)
    if manager is None:
        raise HTTPException(status_code=422, detail="The selected employee no longer exists.")
    if not bool(manager.is_active):
        raise HTTPException(status_code=422, detail=f"{manager.name} is not an active employee.")
    manager_role = manager.user.role if manager.user is not None else None
    has_leadership_access = manager_role == "admin" or (
        manager_role == "pm" and manager.user.access_level == "write"
    )
    if manager.user is None or not has_leadership_access or not bool(manager.user.is_enabled):
        raise HTTPException(
            status_code=422,
            detail="Project leadership requires an enabled Administrator or Project Manager account with read and write permission.",
        )

    project.project_manager = manager
    if all(item.id != project.id for item in manager.assigned_projects):
        manager.assigned_projects.append(project)

    notify_members(
        db,
        [manager],
        kind="project_leadership",
        title=f"You manage {project.name}",
        message="You can now organize this project's team, milestones, tasks, schedule, documents, meetings, and assets.",
        link=f"/projects/{project.id}",
        exclude_user_id=_owner.id,
    )

    db.commit()
    db.refresh(project)
    return project_out(project)


@router.get("/projects/{project_id}/team")
def get_project_team(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    # Team identities are operational data, so clients use the client-safe
    # project views and never receive the internal employee roster.
    if user.role == "client":
        raise HTTPException(status_code=403, detail="Employee rosters are private.")
    require_ids = get_accessible_project_ids(user, db)
    if require_ids is not None and project_id not in require_ids:
        raise HTTPException(status_code=403, detail="You don't have access to this project.")
    return [team_member_out(member) for member in sorted(project.assigned_members, key=lambda item: (item.employee_number or "", item.id))]


@router.put("/projects/{project_id}/team")
def replace_project_team(
    project_id: int,
    inp: ProjectTeamInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Replace one project's working team; its assigned PM may manage only this roster."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_manage_access(db, user, project_id)
    if len(inp.member_ids) != len(set(inp.member_ids)):
        raise HTTPException(status_code=422, detail="Project team cannot contain duplicates.")
    members = db.query(TeamMember).filter(TeamMember.id.in_(inp.member_ids)).all() if inp.member_ids else []
    found = {member.id for member in members}
    missing = sorted(set(inp.member_ids) - found)
    if missing:
        raise HTTPException(status_code=422, detail=f"Unknown employee IDs: {', '.join(map(str, missing))}.")
    if any(not bool(member.is_active) for member in members):
        raise HTTPException(status_code=422, detail="Inactive employees cannot join a project team.")

    manager = project.project_manager
    if manager and manager.id not in found:
        members.append(manager)
    old_ids = {member.id for member in project.assigned_members}
    removed_ids = old_ids - {member.id for member in members}
    if removed_ids:
        active_assignments = (
            db.query(Task)
            .join(Milestone, Milestone.id == Task.milestone_id)
            .join(task_assignees, task_assignees.c.task_id == Task.id)
            .filter(
                Milestone.project_id == project.id,
                task_assignees.c.team_member_id.in_(removed_ids),
                Task.status != "done",
            )
            .count()
        )
        if active_assignments:
            raise HTTPException(
                status_code=409,
                detail="Reassign or complete this employee's open project tasks before removing them from the team.",
            )
    added = [member for member in members if member.id not in old_ids]
    project.assigned_members = members
    if added:
        notify_members(
            db,
            added,
            kind="project_assignment",
            title=f"Added to {project.name}",
            message=f"{user.full_name} added you to this project team. You can now open its tasks, schedule, documents, meetings, and assets.",
            link=f"/projects/{project.id}",
            exclude_user_id=user.id,
        )
    db.commit()
    return [team_member_out(member) for member in sorted(project.assigned_members, key=lambda item: (item.employee_number or "", item.id))]


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    db.delete(project)
    db.commit()
