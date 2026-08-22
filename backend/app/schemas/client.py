from __future__ import annotations

"""Admin client management and client-portal response shapes."""

from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class ClientCreateInput(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    temporary_password: str = Field(min_length=8, max_length=200)
    organization: str | None = Field(default=None, max_length=250)
    job_title: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    project_ids: list[int] = Field(default_factory=list)


class ClientUpdateInput(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    organization: str | None = Field(default=None, max_length=250)
    job_title: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    is_enabled: bool | None = None
    temporary_password: str | None = Field(default=None, min_length=8, max_length=200)


class ClientProjectAssignmentInput(BaseModel):
    project_ids: list[int] = Field(default_factory=list)


class ClientProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    project_type: str
    parent_project_id: int | None
    start_date: str | None
    end_date: str | None
    progress_pct: int
    total_tasks: int
    done_tasks: int
    is_delayed: bool


class ClientProfileOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    organization: str | None
    job_title: str | None
    phone: str | None
    notes: str | None
    is_enabled: bool
    must_change_password: bool
    projects: list[ClientProjectOut]
    shared_report_count: int
    unread_report_count: int
    last_shared_at: str | None
    created_at: str


class ShareableReportOut(BaseModel):
    report_type: Literal["proactive", "incident"]
    report_id: int
    project_id: int
    project_name: str
    title: str
    status: str
    category: str | None
    date: str | None
    already_shared: bool


class ClientReportShareInput(BaseModel):
    report_type: Literal["proactive", "incident"]
    report_id: int
    message: str | None = Field(default=None, max_length=2000)


class ClientReportShareOut(BaseModel):
    id: int
    client_user_id: int
    project_id: int
    project_name: str
    report_type: Literal["proactive", "incident"]
    report_id: int
    title: str
    status: str
    category: str | None
    message: str | None
    shared_by_name: str | None
    shared_at: str
    read_at: str | None
    report: dict[str, Any]


class ClientPortalOut(BaseModel):
    profile: ClientProfileOut
    reports: list[ClientReportShareOut]
