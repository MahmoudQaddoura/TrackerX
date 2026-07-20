from __future__ import annotations

"""
models/meeting.py
Sprint / client meeting minutes attached to a project.
"""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

MEETING_TYPES = ("sprint", "client")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    meeting_type = Column(Text, nullable=False, default="sprint", index=True)
    title = Column(Text, nullable=False)
    meeting_date = Column(Text, nullable=False)  # ISO date string
    discussion_points = Column(Text, nullable=True)  # the notes
    outcome = Column(Text, nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    project = relationship("Project", back_populates="meetings")

    __table_args__ = (
        CheckConstraint("meeting_type IN ('sprint','client')", name="ck_meeting_type"),
    )
