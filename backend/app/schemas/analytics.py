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
    milestone_id: int
    milestone_title: str
    owner: str | None
    delay_cause: str | None
    delay_comment: str | None
    end_date: str | None
    trigger_type: str
    days_overdue: int | None


class DeliveryMapAssignee(BaseModel):
    member_id: int
    name: str
    total_tasks: int
    open_tasks: int
    delayed_tasks: int


class DeliveryMapTask(BaseModel):
    task_id: int
    title: str
    milestone_id: int
    milestone_title: str
    status: str
    is_delayed: bool
    end_date: str | None
    assignee_names: list[str]


class DeliveryMapProject(BaseModel):
    project_id: int
    project_name: str
    project_status: str
    project_manager_name: str | None
    progress_pct: int
    total_tasks: int
    done_tasks: int
    delayed_tasks: int
    blocked_tasks: int
    unassigned_tasks: int
    status_counts: dict[str, int]
    assignees: list[DeliveryMapAssignee]
    attention_tasks: list[DeliveryMapTask]
