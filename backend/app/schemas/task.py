"""
schemas/task.py
Task request/response models. `TaskOut` adds the computed risk level and the
assigned member's display name.
"""

from pydantic import BaseModel, Field


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str = "todo"
    is_delayed: bool = False
    delay_cause: str | None = None  # 'Company' | 'Client'
    delay_comment: str | None = None
    est_days: float | None = None
    assigned_member_id: int | None = None
    sort_order: int = 0


class TaskStatusUpdate(BaseModel):
    """Kanban drag-and-drop: status only. Used by the developer-facing endpoint."""

    status: str


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str | None = None
    is_delayed: bool | None = None
    delay_cause: str | None = None
    delay_comment: str | None = None
    est_days: float | None = None
    assigned_member_id: int | None = None
    sort_order: int | None = None


class TaskOut(BaseModel):
    id: int
    milestone_id: int
    title: str
    description: str | None
    start_date: str | None
    end_date: str | None
    status: str
    is_delayed: bool
    delay_cause: str | None
    delay_comment: str | None
    est_days: float | None
    assigned_member_id: int | None
    assigned_member_name: str | None
    sort_order: int
    created_at: str
    updated_at: str
    # computed
    risk_level: str
