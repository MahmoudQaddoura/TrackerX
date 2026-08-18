from __future__ import annotations

"""Daily attendance records linked to the employee directory."""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

ATTENDANCE_STATUSES = ("present", "remote", "leave", "sick_leave", "absent")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True)
    team_member_id = Column(
        Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attendance_date = Column(Text, nullable=False, index=True)
    status = Column(Text, nullable=False)
    check_in = Column(Text, nullable=True)
    check_out = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    leave_request_id = Column(
        Integer, ForeignKey("leave_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    team_member = relationship("TeamMember", back_populates="attendance_records")
    recorded_by = relationship("User")
    leave_request = relationship("LeaveRequest", back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("team_member_id", "attendance_date", name="uq_attendance_member_date"),
        CheckConstraint(
            "status IN ('present','remote','leave','sick_leave','absent')",
            name="ck_attendance_status",
        ),
    )
