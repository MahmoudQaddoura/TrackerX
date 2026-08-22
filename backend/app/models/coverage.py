from __future__ import annotations

"""Task-coverage offers created while reviewing employee leave requests."""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

COVERAGE_STATUSES = ("pending", "accepted", "declined", "cancelled")


class LeaveCoverageOffer(Base):
    __tablename__ = "leave_coverage_offers"

    id = Column(Integer, primary_key=True)
    leave_request_id = Column(
        Integer,
        ForeignKey("leave_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id = Column(
        Integer,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_member_id = Column(
        Integer,
        ForeignKey("team_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    to_member_id = Column(
        Integer,
        ForeignKey("team_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(Text, nullable=False, default="pending", index=True)
    admin_note = Column(Text, nullable=True)
    response_note = Column(Text, nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    responded_at = Column(Text, nullable=True)

    leave_request = relationship("LeaveRequest", back_populates="coverage_offers")
    task = relationship("Task")
    from_member = relationship("TeamMember", foreign_keys=[from_member_id])
    to_member = relationship("TeamMember", foreign_keys=[to_member_id])
    assigned_by = relationship("User")

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','accepted','declined','cancelled')",
            name="ck_leave_coverage_status",
        ),
    )
