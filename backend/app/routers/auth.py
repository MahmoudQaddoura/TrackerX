"""
routers/auth.py
Login (JSON body) and the current-user endpoint. Mounted at /api/auth.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.auth import LoginInput, TokenResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginInput, db: Session = Depends(get_db)) -> TokenResponse:
    """Verify credentials and return a JWT plus display info."""
    email = payload.email.lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, role=user.role, full_name=user.full_name)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated user."""
    return user
