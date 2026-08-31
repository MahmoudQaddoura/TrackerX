from __future__ import annotations

from pydantic import BaseModel


class EmployeeProfileFileOut(BaseModel):
    id: int
    team_member_id: int
    file_name: str
    content_type: str | None
    file_size: int
    uploaded_by_name: str | None
    created_at: str
