from __future__ import annotations

"""
models/project.py
Top of the hierarchy: a project owns milestones, meetings, and documents.
"""

from sqlalchemy import CheckConstraint, Column, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

PROJECT_STATUSES = ("active", "on_hold", "completed", "archived")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="active")
    start_date = Column(Text, nullable=True)  # ISO date string
    end_date = Column(Text, nullable=True)
    github_repo_url = Column(Text, nullable=True)  # optional GitHub repo link
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    milestones = relationship(
        "Milestone",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Milestone.sort_order",
    )
    meetings = relationship("Meeting", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    clients = relationship("User", secondary="project_clients")
    assigned_members = relationship(
        "TeamMember",
        secondary="team_member_projects",
        back_populates="assigned_projects",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('active','on_hold','completed','archived')", name="ck_project_status"
        ),
    )
