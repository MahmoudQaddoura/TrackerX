from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.team_member import TeamMember


def notify_members(
    db: Session,
    members: list[TeamMember],
    *,
    kind: str,
    title: str,
    message: str,
    link: str | None = None,
    exclude_user_id: int | None = None,
) -> None:
    """Queue one notification per linked login without committing the caller's transaction."""
    seen: set[int] = set()
    for member in members:
        user_id = member.user_id
        if not user_id or user_id == exclude_user_id or user_id in seen:
            continue
        seen.add(user_id)
        db.add(Notification(user_id=user_id, kind=kind, title=title, message=message, link=link))
