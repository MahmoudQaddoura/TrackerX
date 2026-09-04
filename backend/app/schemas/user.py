from __future__ import annotations

"""
schemas/user.py
Admin-only account creation.
"""

from pydantic import BaseModel, EmailStr, Field

from app.models.user import USER_ROLES


class UserCreateInput(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    role: str
    password: str = Field(min_length=12, max_length=128)
    access_level: str = "read"


ROLE_VALUES = set(USER_ROLES)
