from __future__ import annotations

"""
routers/auth.py
Login (JSON body) and the current-user endpoint. Mounted at /api/auth.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.config import settings
from app.deps import get_authenticated_user
from app.models import User
from app.schemas.auth import ChangePasswordInput, LoginInput, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password
from app.services.login_throttle import login_throttle
from app.services.password_policy import validate_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.environment.strip().lower() == "production",
        samesite="strict",
        path="/",
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginInput,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Verify credentials and return a JWT plus display info."""
    email = payload.email.lower()
    address = request.client.host if request.client else "unknown"
    retry_after = login_throttle.retry_after(address, email)
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if (
        user is None
        or not bool(user.is_enabled)
        or not verify_password(payload.password, user.hashed_password)
    ):
        login_throttle.record_failure(address, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )
    login_throttle.record_success(email)
    token = create_access_token(user.id, user.role, int(user.auth_version or 0))
    _set_session_cookie(response, token)
    return TokenResponse(
        role=user.role,
        full_name=user.full_name,
        access_level="write" if user.role == "admin" else user.access_level,
        must_change_password=bool(user.must_change_password),
    )


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        httponly=True,
        secure=settings.environment.strip().lower() == "production",
        samesite="strict",
        path="/",
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_authenticated_user)) -> User:
    """Return the currently authenticated user."""
    return user


@router.put("/change-password", response_model=UserOut)
def change_password(
    payload: ChangePasswordInput,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_authenticated_user),
) -> User:
    """Replace an administrator-issued password before workspace access."""
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="The current password is incorrect.")
    if verify_password(payload.new_password, user.hashed_password):
        raise HTTPException(status_code=422, detail="Choose a password different from the temporary password.")
    try:
        validate_password(payload.new_password, (user.email, user.full_name))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    user.hashed_password = hash_password(payload.new_password)
    user.must_change_password = 0
    user.auth_version = int(user.auth_version or 0) + 1
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.role, int(user.auth_version or 0))
    _set_session_cookie(response, token)
    return user
