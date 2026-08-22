from __future__ import annotations

"""Request and response schemas for Maintenance & Support records."""

from pydantic import BaseModel, Field


class SupportAssigneeOut(BaseModel):
    id: int
    name: str
    role: str | None


class ProactiveReportInput(BaseModel):
    category: str
    title: str = Field(min_length=1, max_length=250)
    status: str = "pending"
    period_start: str | None = None
    period_end: str | None = None
    due_date: str | None = None
    executive_summary: str | None = None
    findings: str | None = None
    work_completed: str | None = None
    recommendations: str | None = None
    next_action_date: str | None = None
    assigned_member_ids: list[int] = Field(default_factory=list)


class ProactiveReportUpdate(BaseModel):
    category: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=250)
    status: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    due_date: str | None = None
    executive_summary: str | None = None
    findings: str | None = None
    work_completed: str | None = None
    recommendations: str | None = None
    next_action_date: str | None = None
    assigned_member_ids: list[int] | None = None


class ProactiveReportOut(BaseModel):
    id: int
    project_id: int
    category: str
    title: str
    status: str
    period_start: str | None
    period_end: str | None
    due_date: str | None
    executive_summary: str | None
    findings: str | None
    work_completed: str | None
    recommendations: str | None
    next_action_date: str | None
    assigned_members: list[SupportAssigneeOut]
    created_by_name: str | None
    created_at: str
    updated_at: str


class SupportIncidentInput(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    client_report: str | None = None
    reason: str | None = None
    description: str | None = None
    reported_at: str
    severity: str = "medium"
    recommendation: str | None = None
    investigation: str | None = None
    response_at: str | None = None
    response_description: str | None = None
    status: str = "reported"
    resolution_notes: str | None = None
    assigned_member_ids: list[int] = Field(default_factory=list)


class SupportIncidentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    client_report: str | None = None
    reason: str | None = None
    description: str | None = None
    reported_at: str | None = None
    severity: str | None = None
    recommendation: str | None = None
    investigation: str | None = None
    response_at: str | None = None
    response_description: str | None = None
    status: str | None = None
    resolution_notes: str | None = None
    assigned_member_ids: list[int] | None = None


class SupportIncidentOut(BaseModel):
    id: int
    project_id: int
    title: str
    client_report: str | None
    reason: str | None
    description: str | None
    reported_at: str
    severity: str
    recommendation: str | None
    investigation: str | None
    response_at: str | None
    response_description: str | None
    status: str
    resolution_notes: str | None
    assigned_members: list[SupportAssigneeOut]
    created_by_name: str | None
    created_at: str
    updated_at: str
