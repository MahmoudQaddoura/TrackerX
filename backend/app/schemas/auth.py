from __future__ import annotations

"""
schemas/auth.py
Request/response shapes for login and the current-user endpoint.
"""

from pydantic import BaseModel, EmailStr, Field


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "cookie"
    role: str
    full_name: str
    access_level: str
    must_change_password: bool


class ChangePasswordInput(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=12, max_length=128)


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    access_level: str
    is_enabled: bool
    is_primary_admin: bool
    must_change_password: bool

    model_config = {"from_attributes": True}
