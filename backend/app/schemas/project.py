from __future__ import annotations

"""
schemas/project.py
Project request/response models. `ProjectOut` includes computed roll-ups
(progress, delay, risk) that are filled in by services/serialize.py.
"""

from pydantic import BaseModel, Field

from app.models.project import PROJECT_STATUSES, PROJECT_TYPES


class ProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    status: str = "active"
    project_type: str = "actual_project"
    parent_project_id: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    github_repo_url: str | None = Field(default=None, max_length=500)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    status: str | None = None
    project_type: str | None = None
    parent_project_id: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    github_repo_url: str | None = Field(default=None, max_length=500)


class ProjectManagerInput(BaseModel):
    project_manager_id: int


class ProjectTeamInput(BaseModel):
    member_ids: list[int] = Field(default_factory=list, max_length=200)


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    project_type: str
    parent_project_id: int | None
    parent_project_name: str | None
    project_manager_id: int | None
    project_manager_name: str | None
    support_workspace_id: int | None
    support_workspace_name: str | None
    start_date: str | None
    end_date: str | None
    github_repo_url: str | None
    created_at: str
    updated_at: str
    # computed
    milestone_count: int
    total_tasks: int
    done_tasks: int
    progress_pct: int
    is_delayed: bool
    risk_level: str


STATUS_VALUES = set(PROJECT_STATUSES)
TYPE_VALUES = set(PROJECT_TYPES)
