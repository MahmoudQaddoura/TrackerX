from __future__ import annotations

"""
schemas/team_member.py
Team directory request/response models.
"""

from pydantic import BaseModel, EmailStr, Field


class TeamMemberInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    name_arabic: str | None = Field(default=None, max_length=200)
    role: str | None = Field(default=None, max_length=200)
    role_description: str | None = Field(default=None, max_length=2000)
    is_active: bool = True


class TeamMemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    name_arabic: str | None = Field(default=None, max_length=200)
    role: str | None = Field(default=None, max_length=200)
    role_description: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class EmployeeCredentialsInput(BaseModel):
    email: EmailStr
    temporary_password: str | None = Field(default=None, min_length=8, max_length=200)
    account_role: str | None = None
    access_level: str = "read"
    is_enabled: bool = True


class EmployeeCredentialsOut(BaseModel):
    user_id: int
    email: EmailStr
    account_role: str
    access_level: str
    is_enabled: bool


class EmployeeProjectsInput(BaseModel):
    project_ids: list[int] = Field(default_factory=list, max_length=500)


class TeamMemberOut(BaseModel):
    id: int
    name: str
    name_arabic: str | None
    role: str | None
    role_description: str | None
    is_active: bool
    task_count: int
    total_tasks: int
    done_tasks: int
    active_est_days: float
    projects: list[dict]
    assigned_project_ids: list[int]
    user_id: int | None
    has_login: bool
    login_email: EmailStr | None
    account_role: str | None
    is_primary_admin: bool
    access_level: str | None
    login_enabled: bool
    profile_file_count: int
    created_at: str
    updated_at: str
