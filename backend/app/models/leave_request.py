from __future__ import annotations

"""Employee leave and absence requests with optional attendance autofill."""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

LEAVE_REQUEST_TYPES = ("leave", "sick_leave", "absent")
LEAVE_REQUEST_STATUSES = ("pending", "approved", "rejected")
LEAVE_DURATION_UNITS = ("days", "hours")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True)
    team_member_id = Column(
        Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False, index=True
    )
    request_type = Column(Text, nullable=False)
    start_date = Column(Text, nullable=False, index=True)
    end_date = Column(Text, nullable=False, index=True)
    duration_unit = Column(Text, nullable=False, default="days")
    start_time = Column(Text, nullable=True)
    end_time = Column(Text, nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="pending", index=True)
    review_note = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    attendance_autofilled = Column(Integer, nullable=False, default=0)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    team_member = relationship("TeamMember", back_populates="leave_requests")
    reviewed_by = relationship("User")
    attendance_records = relationship("AttendanceRecord", back_populates="leave_request")
    coverage_offers = relationship(
        "LeaveCoverageOffer",
        back_populates="leave_request",
        cascade="all, delete-orphan",
        order_by="LeaveCoverageOffer.created_at",
    )

    __table_args__ = (
        CheckConstraint(
            "request_type IN ('leave','sick_leave','absent')",
            name="ck_leave_request_type",
        ),
        CheckConstraint(
            "status IN ('pending','approved','rejected')",
            name="ck_leave_request_status",
        ),
        CheckConstraint(
            "duration_unit IN ('days','hours')",
            name="ck_leave_request_duration_unit",
        ),
        CheckConstraint(
            "attendance_autofilled IN (0,1)",
            name="ck_leave_request_attendance_autofilled",
        ),
    )
