"""
deps.py
FastAPI dependencies for authentication and role/scope enforcement.

Four roles:
  admin     — everything, company-wide (no project filter).
  pm        — all projects (full management across the org).
  developer — only projects they're directly assigned tasks on (Kanban-only).
  client    — only projects they're a client on (read + comment + download).

`get_accessible_project_ids` is the single source of truth for "which
projects can this user see" — `None` means no filter (admin/pm), otherwise a
concrete (possibly empty) set of project ids.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Project, TeamMember, User
from app.models.team import project_clients
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)
_FORBIDDEN_PROJECT = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this project."
)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the current user from the JWT, or raise 401."""
    if not token:
        raise _CREDENTIALS_ERROR
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise _CREDENTIALS_ERROR

    user = db.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_ERROR
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Allow only admins. Use for company-wide management actions."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This action requires an admin account."
        )
    return user


def require_manager(user: User = Depends(get_current_user)) -> User:
    """Allow admin or pm. Use on every milestone/task write endpoint."""
    if user.role not in ("admin", "pm"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires a project manager or admin account.",
        )
    return user


def get_accessible_project_ids(user: User, db: Session) -> set[int] | None:
    """
    The set of project ids `user` may see, or `None` meaning "no filter"
    (admin/pm see everything). An empty set means the user is legitimately
    scoped to nothing yet.
    """
    if user.role in ("admin", "pm"):
        return None
    if user.role == "developer":
        # Developer sees projects where they have at least one assigned task.
        member = db.query(TeamMember).filter(TeamMember.user_id == user.id).first()
        if member is None:
            return set()
        # Collect distinct project IDs from the member's tasks.
        ids: set[int] = set()
        for t in member.tasks:
            if t.milestone:
                ids.add(t.milestone.project_id)
        return ids
    if user.role == "client":
        rows = db.query(project_clients.c.project_id).filter(project_clients.c.user_id == user.id).all()
        return {r[0] for r in rows}
    return set()


def check_project_access(db: Session, user: User, project_id: int) -> None:
    """Raise 403 if `user` may not see the given project. No-op for admin/pm."""
    ids = get_accessible_project_ids(user, db)
    if ids is not None and project_id not in ids:
        raise _FORBIDDEN_PROJECT


def require_project_access(
    project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Project:
    """Dependency for routes keyed directly on a `project_id` path param."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    return project


def require_project_manage_access(
    project_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager)
) -> Project:
    """Like `require_project_access`, but also requires admin/pm (write access)."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    return project
