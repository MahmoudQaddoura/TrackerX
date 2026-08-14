from __future__ import annotations

"""
routers/tasks.py
Tasks nested under a milestone, plus by-id read/update/delete, plus the
Kanban-facing endpoints: a flattened per-project list and a status-only
move endpoint.

Full field edits (PUT /tasks/{id}) require admin/pm. Status-only moves
(PATCH /tasks/{id}/status) are also open to developer, with two rules
mirroring the Jira-style board: a developer can shuffle a card between
todo/in_progress/blocked/in_review freely, but only admin/pm can move a
card into or out of `done`.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import (
    check_project_access,
    get_current_user,
    require_manager,
    require_project_access,
)
from app.models import Milestone, Project, Task, TeamMember, User
from app.models.task import DELAY_CAUSES, TASK_STATUSES
from app.schemas.task import TaskInput, TaskOut, TaskStatusUpdate, TaskUpdate
from app.services.serialize import task_out

router = APIRouter(tags=["tasks"])

DONE_STATUS = "done"


def _task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


def _project_id_of(db: Session, task: Task) -> int:
    return db.get(Milestone, task.milestone_id).project_id


def _normalize_and_validate(data: dict) -> dict:
    """Enforce status/delay rules. Mutates and returns `data`."""
    if "status" in data and data["status"] not in TASK_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{data['status']}'.")
    if data.get("is_delayed"):
        cause = data.get("delay_cause")
        if cause not in DELAY_CAUSES:
            raise HTTPException(
                status_code=422, detail="A delayed task needs a cause of 'Company' or 'Client'."
            )
    if data.get("start_date") and data.get("end_date") and data["start_date"] > data["end_date"]:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")
    # store the bool as 0/1
    if "is_delayed" in data:
        data["is_delayed"] = 1 if data["is_delayed"] else 0
    return data


def _extract_assignee_ids(data: dict) -> list[int] | None:
    """Pop multi/single assignee inputs and return a normalized unique list.

    `None` means an update did not include assignment fields and should leave
    the existing team untouched.
    """
    has_many = "assigned_member_ids" in data
    has_legacy = "assigned_member_id" in data
    member_ids = data.pop("assigned_member_ids", None)
    legacy_id = data.pop("assigned_member_id", None)
    if not has_many and not has_legacy:
        return None
    if member_ids is None:
        member_ids = [legacy_id] if legacy_id is not None else []
    unique_ids: list[int] = []
    for member_id in member_ids:
        if member_id not in unique_ids:
            unique_ids.append(member_id)
    return unique_ids


def _resolve_assignees(db: Session, member_ids: list[int]) -> list[TeamMember]:
    if not member_ids:
        return []
    members = db.query(TeamMember).filter(TeamMember.id.in_(member_ids)).all()
    members_by_id = {member.id: member for member in members}
    missing_ids = [member_id for member_id in member_ids if member_id not in members_by_id]
    if missing_ids:
        raise HTTPException(status_code=422, detail="One or more assignees do not exist.")
    inactive_ids = [member.id for member in members if not bool(member.is_active)]
    if inactive_ids:
        raise HTTPException(status_code=422, detail="Inactive employees cannot receive new tasks.")
    return [members_by_id[member_id] for member_id in member_ids]


def _set_assignees(task: Task, members: list[TeamMember]) -> None:
    task.assigned_members = members
    task.assigned_member_id = members[0].id if members else None


@router.get("/milestones/{milestone_id}/tasks", response_model=list[TaskOut])
def list_tasks(
    milestone_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    ms = db.get(Milestone, milestone_id)
    if ms is None:
        raise HTTPException(status_code=404, detail="Milestone not found.")
    check_project_access(db, user, ms.project_id)
    rows = (
        db.query(Task)
        .filter(Task.milestone_id == milestone_id)
        .order_by(Task.sort_order, Task.id)
        .all()
    )
    return [task_out(t) for t in rows]


@router.post("/milestones/{milestone_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(
    milestone_id: int,
    inp: TaskInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    ms = db.get(Milestone, milestone_id)
    if ms is None:
        raise HTTPException(status_code=404, detail="Milestone not found.")
    check_project_access(db, user, ms.project_id)
    data = _normalize_and_validate(inp.model_dump())
    assignee_ids = _extract_assignee_ids(data) or []
    members = _resolve_assignees(db, assignee_ids)
    task = Task(milestone_id=milestone_id, **data)
    _set_assignees(task, members)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_out(task)


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _task_or_404(db, task_id)
    check_project_access(db, user, _project_id_of(db, task))
    return task_out(task)


@router.put("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int, inp: TaskUpdate, db: Session = Depends(get_db), user: User = Depends(require_manager)
):
    task = _task_or_404(db, task_id)
    check_project_access(db, user, _project_id_of(db, task))
    data = _normalize_and_validate(inp.model_dump(exclude_unset=True))
    assignee_ids = _extract_assignee_ids(data)
    for field, value in data.items():
        setattr(task, field, value)
    if assignee_ids is not None:
        _set_assignees(task, _resolve_assignees(db, assignee_ids))
    db.commit()
    db.refresh(task)
    return task_out(task)


@router.patch("/tasks/{task_id}/status", response_model=TaskOut)
def update_task_status(
    task_id: int,
    inp: TaskStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kanban drag-and-drop. admin/pm: any transition. developer: any
    transition among todo/in_progress/blocked/in_review, but never into or
    out of `done` — that's reserved for admin/pm (typically from in_review)."""
    if user.role not in ("admin", "pm", "developer"):
        raise HTTPException(status_code=403, detail="This account cannot move tasks.")
    if user.role != "admin" and user.access_level != "write":
        raise HTTPException(status_code=403, detail="Your account has read-only access.")
    if inp.status not in TASK_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{inp.status}'.")

    task = _task_or_404(db, task_id)
    project_id = _project_id_of(db, task)
    check_project_access(db, user, project_id)

    if user.role == "developer":
        if task.status == DONE_STATUS or inp.status == DONE_STATUS:
            raise HTTPException(
                status_code=403,
                detail="Only a PM or admin can move a task into or out of Done.",
            )

    task.status = inp.status
    db.commit()
    db.refresh(task)
    return task_out(task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    task = _task_or_404(db, task_id)
    check_project_access(db, user, _project_id_of(db, task))
    db.delete(task)
    db.commit()


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
def list_project_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    project: Project = Depends(require_project_access),
):
    """Flattened tasks across every milestone — feeds the Kanban board.
    Project access is already scoped by role in deps.py, so within a
    project every authorized user sees all tasks."""
    if user.role not in ("admin", "pm", "developer"):
        raise HTTPException(status_code=403, detail="This account cannot view the Kanban board.")

    rows = [t for m in project.milestones for t in m.tasks]
    rows.sort(key=lambda t: (t.milestone_id, t.sort_order, t.id))
    return [task_out(t) for t in rows]
