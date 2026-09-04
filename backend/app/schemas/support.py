from __future__ import annotations

"""Request and response schemas for Maintenance & Support records."""

from pydantic import BaseModel, Field


class SupportAssigneeOut(BaseModel):
    id: int
    name: str
    role: str | None


class ProactiveReportInput(BaseModel):
    category: str
    service_area_name: str | None = Field(default=None, max_length=120)
    title: str = Field(min_length=1, max_length=250)
    status: str = "pending"
    period_start: str | None = None
    period_end: str | None = None
    due_date: str | None = None
    executive_summary: str | None = Field(default=None, max_length=20_000)
    findings: str | None = Field(default=None, max_length=20_000)
    work_completed: str | None = Field(default=None, max_length=20_000)
    recommendations: str | None = Field(default=None, max_length=20_000)
    next_action_date: str | None = None
    assigned_member_ids: list[int] = Field(default_factory=list, max_length=100)


class ProactiveReportUpdate(BaseModel):
    category: str | None = None
    service_area_name: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, min_length=1, max_length=250)
    status: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    due_date: str | None = None
    executive_summary: str | None = Field(default=None, max_length=20_000)
    findings: str | None = Field(default=None, max_length=20_000)
    work_completed: str | None = Field(default=None, max_length=20_000)
    recommendations: str | None = Field(default=None, max_length=20_000)
    next_action_date: str | None = None
    assigned_member_ids: list[int] | None = Field(default=None, max_length=100)


class ProactiveReportOut(BaseModel):
    id: int
    project_id: int
    category: str
    service_area_name: str | None
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
    detection_source: str = "team"
    reported_by_name: str | None = Field(default=None, max_length=160)
    affected_service: str | None = Field(default=None, max_length=180)
    client_report: str | None = Field(default=None, max_length=20_000)
    reason: str | None = Field(default=None, max_length=20_000)
    description: str | None = Field(default=None, max_length=20_000)
    reported_at: str
    severity: str = "medium"
    recommendation: str | None = Field(default=None, max_length=20_000)
    containment_actions: str | None = Field(default=None, max_length=20_000)
    investigation: str | None = Field(default=None, max_length=20_000)
    root_cause: str | None = Field(default=None, max_length=20_000)
    response_at: str | None = None
    response_description: str | None = Field(default=None, max_length=20_000)
    recovery_validation: str | None = Field(default=None, max_length=20_000)
    status: str = "reported"
    resolution_notes: str | None = Field(default=None, max_length=20_000)
    lessons_learned: str | None = Field(default=None, max_length=20_000)
    assigned_member_ids: list[int] = Field(default_factory=list, max_length=100)


class SupportIncidentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    detection_source: str | None = None
    reported_by_name: str | None = Field(default=None, max_length=160)
    affected_service: str | None = Field(default=None, max_length=180)
    client_report: str | None = Field(default=None, max_length=20_000)
    reason: str | None = Field(default=None, max_length=20_000)
    description: str | None = Field(default=None, max_length=20_000)
    reported_at: str | None = None
    severity: str | None = None
    recommendation: str | None = Field(default=None, max_length=20_000)
    containment_actions: str | None = Field(default=None, max_length=20_000)
    investigation: str | None = Field(default=None, max_length=20_000)
    root_cause: str | None = Field(default=None, max_length=20_000)
    response_at: str | None = None
    response_description: str | None = Field(default=None, max_length=20_000)
    recovery_validation: str | None = Field(default=None, max_length=20_000)
    status: str | None = None
    resolution_notes: str | None = Field(default=None, max_length=20_000)
    lessons_learned: str | None = Field(default=None, max_length=20_000)
    assigned_member_ids: list[int] | None = Field(default=None, max_length=100)


class SupportIncidentOut(BaseModel):
    id: int
    project_id: int
    title: str
    detection_source: str
    reported_by_name: str | None
    affected_service: str | None
    client_report: str | None
    reason: str | None
    description: str | None
    reported_at: str
    severity: str
    recommendation: str | None
    containment_actions: str | None
    investigation: str | None
    root_cause: str | None
    response_at: str | None
    response_description: str | None
    recovery_validation: str | None
    status: str
    resolution_notes: str | None
    lessons_learned: str | None
    assigned_members: list[SupportAssigneeOut]
    created_by_name: str | None
    created_at: str
    updated_at: str
