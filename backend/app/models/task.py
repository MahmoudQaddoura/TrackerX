from __future__ import annotations

"""
models/task.py
Leaf work item. Carries schedule dates (for the Gantt), status, delay flags,
an optional estimated-effort figure (preserved from CSV import), and an
assignments to one or more team members.
"""

from sqlalchemy import CheckConstraint, Column, Float, ForeignKey, Integer, Table, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

TASK_STATUSES = ("todo", "in_progress", "in_review", "blocked", "done")
DELAY_CAUSES = ("Company", "Client")


task_assignees = Table(
    "task_assignees",
    Base.metadata,
    Column("task_id", ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "team_member_id",
        ForeignKey("team_members.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    milestone_id = Column(
        Integer, ForeignKey("milestones.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Text, nullable=True)
    end_date = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="todo", index=True)
    is_delayed = Column(Integer, nullable=False, default=0)  # 0/1 boolean
    delay_cause = Column(Text, nullable=True)  # 'Company' | 'Client' | None
    delay_comment = Column(Text, nullable=True)
    est_days = Column(Float, nullable=True)  # estimated effort (from CSV)
    assigned_member_id = Column(
        Integer, ForeignKey("team_members.id", ondelete="SET NULL"), index=True, nullable=True
    )
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    milestone = relationship("Milestone", back_populates="tasks")
    # `assigned_member_id` remains as the first/primary assignee for backwards
    # compatibility. `assigned_members` is the source of truth for the UI.
    assigned_member = relationship("TeamMember", back_populates="tasks")
    assigned_members = relationship(
        "TeamMember",
        secondary=task_assignees,
        back_populates="assigned_tasks",
        order_by="TeamMember.name",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('todo','in_progress','in_review','blocked','done')",
            name="ck_task_status",
        ),
        CheckConstraint("is_delayed IN (0,1)", name="ck_task_is_delayed"),
        CheckConstraint(
            "delay_cause IN ('Company','Client') OR delay_cause IS NULL", name="ck_task_delay_cause"
        ),
    )
