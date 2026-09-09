from __future__ import annotations

"""Persistent, user-scoped activity notifications."""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(Text, nullable=False, default="project_update")
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(Text, nullable=True)
    is_read = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(Text, nullable=False, default=now_iso, index=True)

    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        CheckConstraint("is_read IN (0,1)", name="ck_notification_is_read"),
    )
