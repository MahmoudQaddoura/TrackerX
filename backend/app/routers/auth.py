from __future__ import annotations

"""
routers/auth.py
Login (JSON body) and the current-user endpoint. Mounted at /api/auth.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_authenticated_user
from app.models import User
from app.schemas.auth import ChangePasswordInput, LoginInput, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginInput, db: Session = Depends(get_db)) -> TokenResponse:
    """Verify credentials and return a JWT plus display info."""
    email = payload.email.lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if (
        user is None
        or not bool(user.is_enabled)
        or not verify_password(payload.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )
    token = create_access_token(user.id, user.role)
    return TokenResponse(
        access_token=token,
        role=user.role,
        full_name=user.full_name,
        access_level="write" if user.role == "admin" else user.access_level,
        must_change_password=bool(user.must_change_password),
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_authenticated_user)) -> User:
    """Return the currently authenticated user."""
    return user


@router.put("/change-password", response_model=UserOut)
def change_password(
    payload: ChangePasswordInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_authenticated_user),
) -> User:
    """Replace an administrator-issued password before workspace access."""
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="The current password is incorrect.")
    if verify_password(payload.new_password, user.hashed_password):
        raise HTTPException(status_code=422, detail="Choose a password different from the temporary password.")
    user.hashed_password = hash_password(payload.new_password)
    user.must_change_password = 0
    db.commit()
    db.refresh(user)
    return user
