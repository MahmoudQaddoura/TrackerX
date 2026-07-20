from __future__ import annotations

"""
models/team.py
Gone: Team, project_teams, team_member_teams (teams feature removed 2026-07-19).

Kept: project_clients join table — still needed for scoping `client` users
to only their own project(s).
"""

from sqlalchemy import Column, ForeignKey, Integer, Table

from app.db import Base

project_clients = Table(
    "project_clients",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)
