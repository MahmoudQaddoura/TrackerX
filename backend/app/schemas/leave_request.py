from __future__ import annotations

"""Request and response shapes for employee leave and absence submissions."""

from pydantic import BaseModel, Field


class LeaveRequestCreate(BaseModel):
    request_type: str
    start_date: str
    end_date: str
    reason: str = Field(min_length=3, max_length=1000)


class LeaveRequestReview(BaseModel):
    status: str
    review_note: str | None = Field(default=None, max_length=1000)
    autofill_attendance: bool = False


class LeaveRequestOut(BaseModel):
    id: int
    team_member_id: int
    employee_name: str
    employee_role: str | None
    request_type: str
    start_date: str
    end_date: str
    reason: str
    status: str
    review_note: str | None
    reviewed_by_name: str | None
    attendance_autofilled: bool
    created_at: str
    updated_at: str
