from __future__ import annotations

"""
models package
Importing this package registers every ORM model on the shared Base metadata,
so `Base.metadata.create_all()` sees all tables. One model = one file.
"""

from app.models.user import User
from app.models.team import project_clients
from app.models.project import Project
from app.models.milestone import Milestone
from app.models.task import Task
from app.models.team_member import TeamMember
from app.models.document import Document
from app.models.meeting import Meeting
from app.models.comment import Comment

__all__ = [
    "User",
    "project_clients",
    "Project",
    "Milestone",
    "Task",
    "TeamMember",
    "Document",
    "Meeting",
    "Comment",
]
