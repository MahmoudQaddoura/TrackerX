from __future__ import annotations

"""
routers/users.py
Admin-only account creation. Team-member login linkage (tying a new
developer/pm account to an existing team_members row) happens separately
via the teams router's attach-member flow using the returned user id.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_admin
from app.models import User
from app.schemas.auth import UserOut
from app.schemas.user import ROLE_VALUES, UserCreateInput
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(User).order_by(User.full_name).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(inp: UserCreateInput, db: Session = Depends(get_db), _=Depends(require_admin)):
    if inp.role not in ROLE_VALUES:
        raise HTTPException(status_code=422, detail=f"Invalid role '{inp.role}'.")
    email = inp.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first() is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    user = User(
        email=email,
        full_name=inp.full_name,
        role=inp.role,
        hashed_password=hash_password(inp.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
