from __future__ import annotations

"""
schemas/document.py
Document metadata response. (Upload uses multipart form fields, not JSON, so
there is no DocumentInput model — see routers/documents.py.)
Note: file_path is deliberately never exposed.
"""

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: int
    project_id: int
    milestone_id: int | None
    category: str
    title: str
    description: str | None
    file_name: str
    content_type: str | None
    file_size: int | None
    uploaded_by_id: int | None
    created_at: str
    updated_at: str


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=10_000)
    category: str | None = None
