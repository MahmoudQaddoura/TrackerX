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

from app.db import get_db
from app.deps import (
    get_accessible_project_ids,
    get_current_user,
    require_admin,
    require_primary_admin,
    require_project_access,
    require_project_manage_access,
)
from app.models import Project, ProactiveServiceReport, TeamMember, User
from app.models.support import PROACTIVE_CATEGORY_TEMPLATES
from app.schemas.project import (
    ProjectInput,
    ProjectManagerInput,
    ProjectOut,
    ProjectUpdate,
    STATUS_VALUES,
    TYPE_VALUES,
)
from app.services.serialize import project_out

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
    """Assign one active employee as the project's PM. Owner-only."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    manager = db.get(TeamMember, inp.project_manager_id)
    if manager is None:
        raise HTTPException(status_code=422, detail="The selected employee no longer exists.")
    if not bool(manager.is_active):
        raise HTTPException(status_code=422, detail=f"{manager.name} is not an active employee.")

    project.project_manager = manager
    if all(item.id != project.id for item in manager.assigned_projects):
        manager.assigned_projects.append(project)

    db.commit()
    db.refresh(project)
    return project_out(project)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    db.delete(project)
    db.commit()
