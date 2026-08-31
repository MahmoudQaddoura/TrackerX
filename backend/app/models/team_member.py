from __future__ import annotations

"""
models/team_member.py
The employee directory — a person's name and role (e.g. "Backend Engineer").
Distinct from auth `users`: most employees do not log in and exist only
as assignees (e.g. imported from a CSV). `user_id` is set only when this
person also has a login (a `developer` or a `pm`).

Deletion is a soft delete (is_active -> 0) so historical task assignments
and attribution survive a person leaving.
"""

from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True)
    employee_number = Column(Text, unique=True, nullable=True)
    name = Column(Text, nullable=False)
    name_arabic = Column(Text, nullable=True)
    role = Column(Text, nullable=True)  # free text, e.g. "Backend Engineer"
    role_description = Column(Text, nullable=True)
    is_active = Column(Integer, nullable=False, default=1)  # 0/1 boolean
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    tasks = relationship("Task", back_populates="assigned_member")
    assigned_tasks = relationship(
        "Task",
        secondary="task_assignees",
        back_populates="assigned_members",
    )
    assigned_projects = relationship(
        "Project",
        secondary="team_member_projects",
        back_populates="assigned_members",
    )
    managed_projects = relationship(
        "Project",
        foreign_keys="Project.project_manager_id",
        back_populates="project_manager",
    )
    attendance_records = relationship(
        "AttendanceRecord",
        back_populates="team_member",
        cascade="all, delete-orphan",
    )
    leave_requests = relationship(
        "LeaveRequest",
        back_populates="team_member",
        cascade="all, delete-orphan",
    )
    profile_files = relationship(
        "EmployeeProfileFile",
        back_populates="team_member",
        cascade="all, delete-orphan",
    )
    user = relationship("User")
