from __future__ import annotations

"""
schemas/project.py
Project request/response models. `ProjectOut` includes computed roll-ups
(progress, delay, risk) that are filled in by services/serialize.py.
"""

from pydantic import BaseModel, Field

from app.models.project import PROJECT_STATUSES


class ProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: str = "active"
    start_date: str | None = None
    end_date: str | None = None
    github_repo_url: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    github_repo_url: str | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
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
