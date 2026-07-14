"""
routers/csv_import.py
Admin-only: create a whole project (with milestones and tasks) from an
uploaded project-plan CSV. Assignee names are matched to existing active
team members (case-insensitive) or created on the fly, so the Team
directory stays in sync. The new project isn't assigned to any team/client
yet — that's done afterwards via the teams router, same as any other
newly-created project.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_admin
from app.models import Milestone, Project, Task, TeamMember
from app.schemas.project import ProjectOut
from app.services.csv_parser import parse_project_csv
from app.services.serialize import project_out

router = APIRouter(tags=["projects"])


def _find_or_create_member(db: Session, cache: dict[str, TeamMember], name: str) -> TeamMember:
    """Reuse an existing member with the same name (case-insensitive), else create one."""
    key = name.strip().lower()
    if key in cache:
        return cache[key]
    member = db.query(TeamMember).filter(TeamMember.name.ilike(name.strip())).first()
    if member is None:
        member = TeamMember(name=name.strip(), role="Team Member", is_active=1)
        db.add(member)
        db.flush()  # assign an id without committing yet
    cache[key] = member
    return member


@router.post("/projects/import-csv", response_model=ProjectOut, status_code=201)
async def import_project_csv(
    file: UploadFile = File(...), db: Session = Depends(get_db), _=Depends(require_admin)
):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Uploaded CSV is empty.")
    try:
        outline = parse_project_csv(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    project = Project(name=outline["name"], status="active")
    db.add(project)
    db.flush()

    member_cache: dict[str, TeamMember] = {}
    for ms_order, ms in enumerate(outline["milestones"]):
        milestone = Milestone(project_id=project.id, title=ms["title"], sort_order=ms_order)
        db.add(milestone)
        db.flush()
        for t_order, t in enumerate(ms["tasks"]):
            member_id = None
            if t.get("assignee"):
                member = _find_or_create_member(db, member_cache, t["assignee"])
                member_id = member.id
            db.add(
                Task(
                    milestone_id=milestone.id,
                    title=t["title"],
                    description=t.get("description"),
                    est_days=t.get("est_days"),
                    status="todo",
                    assigned_member_id=member_id,
                    sort_order=t_order,
                )
            )

    db.commit()
    db.refresh(project)
    return project_out(project)
