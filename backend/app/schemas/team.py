"""
schemas/team.py
Team request/response models. `TeamOut` includes computed roll-ups (member
count, total tasks, workload/capacity) filled in by services/serialize.py.
"""

from pydantic import BaseModel, Field


class TeamInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    function: str | None = Field(default=None, max_length=200)
    lead_user_id: int | None = None
    weekly_capacity_days: float | None = None
    project_ids: list[int] = Field(default_factory=list)


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    function: str | None = Field(default=None, max_length=200)
    lead_user_id: int | None = None
    weekly_capacity_days: float | None = None
    project_ids: list[int] | None = None


class TeamMemberAttachInput(BaseModel):
    """Attach an existing team_member, or create a new one by name."""

    team_member_id: int | None = None
    name: str | None = Field(default=None, max_length=200)
    role: str | None = Field(default=None, max_length=200)


class TeamOut(BaseModel):
    id: int
    name: str
    function: str | None
    lead_user_id: int | None
    lead_name: str | None
    weekly_capacity_days: float | None
    created_at: str
    updated_at: str
    # computed
    project_ids: list[int]
    project_names: list[str]
    member_count: int
    total_tasks: int
    active_task_est_days: float
    load_pct: float | None  # null until weekly_capacity_days is set
