from __future__ import annotations

"""Leave task-coverage planning, assignment, and response shapes."""

from pydantic import BaseModel, Field


class CoverageTaskPreview(BaseModel):
    id: int
    title: str
    project_id: int
    project_name: str
    milestone_name: str
    status: str
    severity: str
    risk_level: str
    due_date: str | None
    est_days: float | None


class CoverageTaskOut(CoverageTaskPreview):
    current_assignees: list[str]
    requires_assignment: bool
    coverage_status: str | None
    coverage_assignee_id: int | None
    coverage_assignee_name: str | None


class CoverageCandidateOut(BaseModel):
    id: int
    name: str
    role: str | None
    eligible: bool
    availability: str
    availability_note: str | None
    open_task_count: int
    high_severity_count: int
    active_est_days: float
    workload_level: str
    current_tasks: list[CoverageTaskPreview]


class CoveragePlanOut(BaseModel):
    leave_request_id: int
    employee_id: int
    employee_name: str
    start_date: str
    end_date: str
    duration_unit: str
    reason: str
    request_status: str
    tasks: list[CoverageTaskOut]
    candidates: list[CoverageCandidateOut]


class CoverageAssignmentInput(BaseModel):
    task_id: int
    to_member_id: int


class CoverageAssignInput(BaseModel):
    assignments: list[CoverageAssignmentInput] = Field(default_factory=list)
    review_note: str | None = Field(default=None, max_length=1000)
    coverage_note: str | None = Field(default=None, max_length=1000)
    autofill_attendance: bool = True


class CoverageOfferOut(BaseModel):
    id: int
    leave_request_id: int
    task_id: int
    task_title: str
    project_id: int
    project_name: str
    milestone_name: str
    from_member_id: int
    from_member_name: str
    to_member_id: int
    to_member_name: str
    assigned_by_name: str | None
    status: str
    severity: str
    risk_level: str
    due_date: str | None
    est_days: float | None
    leave_start_date: str
    leave_end_date: str
    admin_note: str | None
    response_note: str | None
    created_at: str
    responded_at: str | None


class CoverageAssignResult(BaseModel):
    leave_request_id: int
    leave_status: str
    offers_created: int
    offers: list[CoverageOfferOut]


class CoverageResponseInput(BaseModel):
    action: str
    response_note: str | None = Field(default=None, max_length=1000)
