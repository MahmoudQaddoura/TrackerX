from __future__ import annotations

"""
schemas/meeting.py
Meeting-minutes request/response models.
"""

from pydantic import BaseModel, Field


class MeetingInput(BaseModel):
    meeting_type: str = "sprint"  # 'sprint' | 'client'
    title: str = Field(min_length=1, max_length=300)
    meeting_date: str  # ISO date
    discussion_points: str | None = None
    outcome: str | None = None


class MeetingUpdate(BaseModel):
    meeting_type: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)
    meeting_date: str | None = None
    discussion_points: str | None = None
    outcome: str | None = None


class MeetingOut(BaseModel):
    id: int
    project_id: int
    meeting_type: str
    title: str
    meeting_date: str
    discussion_points: str | None
    outcome: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
