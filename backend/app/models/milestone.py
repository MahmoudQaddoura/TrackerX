"""
models/milestone.py
A phase of a project. Owns tasks and (optionally) documents.
"""

from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Text, nullable=True)
    end_date = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    project = relationship("Project", back_populates="milestones")
    tasks = relationship(
        "Task",
        back_populates="milestone",
        cascade="all, delete-orphan",
        order_by="Task.sort_order",
    )
    documents = relationship("Document", back_populates="milestone")
