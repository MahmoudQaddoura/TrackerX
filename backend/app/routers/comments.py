from __future__ import annotations

"""
routers/comments.py
Comments on a task or milestone. Admin, pm, and client may post (client
feedback works like a client leaving notes for the PM); developers don't
comment — they only move cards on the Kanban board. A comment may be
deleted by its author or by any admin/pm. Scoped to projects the caller
can see.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import check_project_access, get_current_user
from app.models import Comment, Milestone, Task, User
from app.models.comment import COMMENT_ENTITY_TYPES
from app.schemas.comment import CommentInput, CommentOut
from app.services.serialize import comment_out

router = APIRouter(prefix="/comments", tags=["comments"])


def _entity_project_id(db: Session, entity_type: str, entity_id: int) -> int:
    if entity_type not in COMMENT_ENTITY_TYPES:
        raise HTTPException(status_code=422, detail="entity_type must be 'task' or 'milestone'.")
    if entity_type == "task":
        task = db.get(Task, entity_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")
        return db.get(Milestone, task.milestone_id).project_id
    milestone = db.get(Milestone, entity_id)
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found.")
    return milestone.project_id


@router.get("", response_model=list[CommentOut])
def list_comments(
    entity_type: str, entity_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    project_id = _entity_project_id(db, entity_type, entity_id)
    check_project_access(db, user, project_id)
    rows = (
        db.query(Comment)
        .filter(Comment.entity_type == entity_type, Comment.entity_id == entity_id)
        .order_by(Comment.created_at)
        .all()
    )
    return [comment_out(c) for c in rows]


@router.post("", response_model=CommentOut, status_code=201)
def create_comment(
    entity_type: str,
    entity_id: int,
    inp: CommentInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in ("admin", "pm", "client"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This account cannot post comments."
        )
    project_id = _entity_project_id(db, entity_type, entity_id)
    check_project_access(db, user, project_id)
    comment = Comment(
        entity_type=entity_type, entity_id=entity_id, author_id=user.id, body=inp.body
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment_out(comment)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found.")
    project_id = _entity_project_id(db, comment.entity_type, comment.entity_id)
    check_project_access(db, user, project_id)
    if comment.author_id != user.id and user.role not in ("admin", "pm"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own comments."
        )
    db.delete(comment)
    db.commit()
