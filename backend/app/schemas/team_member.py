from __future__ import annotations

"""
schemas/team_member.py
Team directory request/response models.
"""

from pydantic import BaseModel, Field


class TeamMemberInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    role: str | None = Field(default=None, max_length=200)
    is_active: bool = True


class TeamMemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = Field(default=None, max_length=200)
    is_active: bool | None = None


class TeamMemberOut(BaseModel):
    id: int
    name: str
    role: str | None
    is_active: bool
    task_count: int
    total_tasks: int
    done_tasks: int
    active_est_days: float
    projects: list[dict]
    user_id: int | None
    has_login: bool
    created_at: str
    updated_at: str
