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
    require_project_access,
    require_project_manage_access,
)
from app.models import Project, User
from app.schemas.project import ProjectInput, ProjectOut, ProjectUpdate, STATUS_VALUES
from app.services.serialize import project_out

router = APIRouter(tags=["projects"])


def _validate(inp: ProjectInput | ProjectUpdate) -> None:
    if inp.status is not None and inp.status not in STATUS_VALUES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{inp.status}'.")
    if inp.start_date and inp.end_date and inp.start_date > inp.end_date:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")


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
def create_project(inp: ProjectInput, db: Session = Depends(get_db), _=Depends(require_admin)):
    _validate(inp)
    project = Project(**inp.model_dump())
    db.add(project)
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
    _validate(inp)
    for field, value in inp.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
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
