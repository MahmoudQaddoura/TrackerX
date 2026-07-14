"""
routers/teams.py
Team CRUD (admin-only for metadata: name, function, lead, capacity, project
assignments) plus roster management (attach/detach a member), which is open
to admin OR the team's own lead — a pm manages who's on their team without
being able to touch team metadata or any other team's roster.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Project, Team, TeamMember, User
from app.deps import get_current_user, require_admin
from app.schemas.team import TeamInput, TeamMemberAttachInput, TeamOut, TeamUpdate
from app.services.serialize import team_out

router = APIRouter(prefix="/teams", tags=["team"])


def _team_or_404(db: Session, team_id: int) -> Team:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found.")
    return team


def _require_admin_or_lead(db: Session, user: User, team: Team) -> None:
    if user.role == "admin":
        return
    if user.role == "pm" and team.lead_user_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only an admin or this team's lead can do that.",
    )


def _set_projects(db: Session, team: Team, project_ids: list[int]) -> None:
    if not project_ids:
        team.projects = []
        return
    projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    if len(projects) != len(set(project_ids)):
        raise HTTPException(status_code=422, detail="One or more project_ids do not exist.")
    team.projects = projects


@router.get("", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Team)
    if user.role == "pm":
        q = q.filter(Team.lead_user_id == user.id)
    elif user.role != "admin":
        # developer/client don't manage teams; nothing to show here.
        return []
    return [team_out(t) for t in q.order_by(Team.name).all()]


@router.post("", response_model=TeamOut, status_code=201)
def create_team(inp: TeamInput, db: Session = Depends(get_db), _=Depends(require_admin)):
    if inp.lead_user_id is not None:
        lead = db.get(User, inp.lead_user_id)
        if lead is None or lead.role != "pm":
            raise HTTPException(status_code=422, detail="lead_user_id must be an existing pm account.")
    team = Team(
        name=inp.name,
        function=inp.function,
        lead_user_id=inp.lead_user_id,
        weekly_capacity_days=inp.weekly_capacity_days,
    )
    db.add(team)
    db.flush()
    _set_projects(db, team, inp.project_ids)
    db.commit()
    db.refresh(team)
    return team_out(team)


@router.get("/{team_id}", response_model=TeamOut)
def get_team(team_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    team = _team_or_404(db, team_id)
    _require_admin_or_lead(db, user, team)
    return team_out(team)


@router.put("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int, inp: TeamUpdate, db: Session = Depends(get_db), _=Depends(require_admin)
):
    team = _team_or_404(db, team_id)
    data = inp.model_dump(exclude_unset=True)
    project_ids = data.pop("project_ids", None)
    if "lead_user_id" in data and data["lead_user_id"] is not None:
        lead = db.get(User, data["lead_user_id"])
        if lead is None or lead.role != "pm":
            raise HTTPException(status_code=422, detail="lead_user_id must be an existing pm account.")
    for field, value in data.items():
        setattr(team, field, value)
    if project_ids is not None:
        _set_projects(db, team, project_ids)
    db.commit()
    db.refresh(team)
    return team_out(team)


@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    db.delete(_team_or_404(db, team_id))
    db.commit()


@router.post("/{team_id}/members", response_model=TeamOut)
def attach_member(
    team_id: int,
    inp: TeamMemberAttachInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    team = _team_or_404(db, team_id)
    _require_admin_or_lead(db, user, team)

    if inp.team_member_id is not None:
        member = db.get(TeamMember, inp.team_member_id)
        if member is None:
            raise HTTPException(status_code=404, detail="Team member not found.")
    else:
        if not inp.name:
            raise HTTPException(
                status_code=422, detail="Provide either team_member_id or a name to create one."
            )
        member = TeamMember(name=inp.name, role=inp.role, is_active=1)
        db.add(member)
        db.flush()

    member.team_id = team.id
    db.commit()
    db.refresh(team)
    return team_out(team)


@router.delete("/{team_id}/members/{member_id}", response_model=TeamOut)
def detach_member(
    team_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    team = _team_or_404(db, team_id)
    _require_admin_or_lead(db, user, team)
    member = db.get(TeamMember, member_id)
    if member is None or member.team_id != team.id:
        raise HTTPException(status_code=404, detail="This member is not on this team.")
    member.team_id = None
    db.commit()
    db.refresh(team)
    return team_out(team)
