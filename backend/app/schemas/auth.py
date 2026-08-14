from __future__ import annotations

"""
schemas/auth.py
Request/response shapes for login and the current-user endpoint.
"""

from pydantic import BaseModel, EmailStr


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    access_level: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    access_level: str
    is_enabled: bool

    model_config = {"from_attributes": True}
