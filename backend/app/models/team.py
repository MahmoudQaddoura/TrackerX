"""
models/team.py
A Team has one lead (a `pm` user) and owns a roster of TeamMembers. Teams are
assigned to projects (many-to-many via `project_teams`) — that assignment is
the access-control backbone for scoping a `pm`/`developer` to only the
projects their team works on. `project_clients` is the equivalent backbone
for scoping a `client` user to only their own project(s).
"""

from sqlalchemy import Column, Float, ForeignKey, Integer, Table, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

project_teams = Table(
    "project_teams",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
)

project_clients = Table(
    "project_clients",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    function = Column(Text, nullable=True)  # free text, e.g. "Backend Engineering"
    lead_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    weekly_capacity_days = Column(Float, nullable=True)  # admin-set; null = not configured
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    lead = relationship("User", foreign_keys=[lead_user_id])
    members = relationship("TeamMember", back_populates="team")
    projects = relationship("Project", secondary=project_teams, back_populates="teams")
