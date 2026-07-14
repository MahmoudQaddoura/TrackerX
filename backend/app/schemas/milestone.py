"""
schemas/milestone.py
Milestone request/response models with computed roll-ups.
"""

from pydantic import BaseModel, Field


class MilestoneInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    sort_order: int = 0


class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    sort_order: int | None = None


class MilestoneOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    start_date: str | None
    end_date: str | None
    sort_order: int
    created_at: str
    updated_at: str
    # computed
    total_tasks: int
    done_tasks: int
    progress_pct: int
    is_delayed: bool
    risk_level: str
