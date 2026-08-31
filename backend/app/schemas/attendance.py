from __future__ import annotations

from pydantic import BaseModel, Field


class AttendanceInput(BaseModel):
    team_member_id: int
    attendance_date: str
    status: str
    check_in: str | None = None
    check_out: str | None = None
    notes: str | None = Field(default=None, max_length=1000)


class AttendanceBulkInput(BaseModel):
    records: list[AttendanceInput]


class AttendanceExportInput(BaseModel):
    records: list[AttendanceInput]


class AttendanceOut(BaseModel):
    id: int | None
    team_member_id: int
    employee_number: str
    employee_name: str
    employee_role: str | None
    attendance_date: str
    status: str
    check_in: str | None
    check_out: str | None
    notes: str | None
    recorded_by_name: str | None
    leave_request_id: int | None
    updated_at: str | None
