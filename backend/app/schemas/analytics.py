from __future__ import annotations

"""
schemas/analytics.py
Response shapes for the dashboard analytics endpoints.
"""

from pydantic import BaseModel


class SummaryOut(BaseModel):
    total_projects: int
    active_projects: int
    total_tasks: int
    done_tasks: int
    progress_pct: int
    delayed_tasks: int


class StatusBreakdownItem(BaseModel):
    status: str
    count: int


class ProjectTimelineItem(BaseModel):
    project_id: int
    name: str
    progress_pct: int
    is_delayed: bool


class DelayedTaskItem(BaseModel):
    task_id: int
    task_title: str
    project_id: int
    project_name: str
    milestone_title: str
    owner: str | None
    delay_cause: str | None
    delay_comment: str | None
    end_date: str | None
