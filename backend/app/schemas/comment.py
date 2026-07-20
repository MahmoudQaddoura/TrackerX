from __future__ import annotations

"""
schemas/comment.py
Comment request/response models. Comments attach to a task or milestone.
"""

from pydantic import BaseModel, Field


class CommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class CommentOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    author_id: int
    author_name: str
    author_role: str
    body: str
    created_at: str
    updated_at: str
