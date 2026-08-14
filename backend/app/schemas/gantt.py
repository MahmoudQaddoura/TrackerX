from __future__ import annotations

"""
schemas/gantt.py
frappe-gantt-shaped task rows for a single project.
"""

from pydantic import BaseModel, Field


class GanttTask(BaseModel):
    id: str
    name: str
    start: str  # ISO date
    end: str  # ISO date
    progress: int  # 0–100
    custom_class: str  # e.g. 'gantt-delayed-bar'
    entity_type: str
    milestone_id: int
    milestone_name: str
    workstream: str
    task_id: int | None = None
    status: str | None = None
    is_delayed: bool = False
    is_auto_scheduled: bool = False
    assignee_names: list[str] = Field(default_factory=list)
