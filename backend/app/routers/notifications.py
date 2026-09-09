from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Notification, User
from app.schemas.notification import NotificationCountOut, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _out(item: Notification) -> dict:
    return {
        "id": item.id,
        "kind": item.kind,
        "title": item.title,
        "message": item.message,
        "link": item.link,
        "is_read": bool(item.is_read),
        "created_at": item.created_at,
    }


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read == 0)
    return [_out(item) for item in query.order_by(Notification.created_at.desc()).limit(limit).all()]


@router.get("/count", response_model=NotificationCountOut)
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"unread": db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == 0).count()}


@router.patch("/read-all", status_code=204)
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == 0).update({"is_read": 1})
    db.commit()


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.get(Notification, notification_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found.")
    item.is_read = 1
    db.commit()
    db.refresh(item)
    return _out(item)
