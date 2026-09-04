from __future__ import annotations

"""
models/user.py
Auth account. Four roles:
  admin     - full CRUD, company-wide (every project/team)
  pm        - full CRUD, scoped to projects assigned to a team they lead
  developer - Kanban-only, can drag cards between columns but not edit fields
  client    - read + comment + download, scoped to their own project(s)
"""

from sqlalchemy import CheckConstraint, Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

USER_ROLES = ("admin", "pm", "developer", "client")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    hashed_password = Column(Text, nullable=False)
    full_name = Column(Text, nullable=False)
    role = Column(Text, nullable=False, default="client")
    access_level = Column(Text, nullable=False, default="read")
    is_enabled = Column(Integer, nullable=False, default=1)
    is_primary_admin = Column(Integer, nullable=False, default=0)
    must_change_password = Column(Integer, nullable=False, default=0)
    auth_version = Column(Integer, nullable=False, default=0)
    created_at = Column(Text, nullable=False, default=now_iso)

    client_profile = relationship(
        "ClientProfile",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    report_shares = relationship(
        "ClientReportShare",
        foreign_keys="ClientReportShare.client_user_id",
        back_populates="client",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("role IN ('admin','pm','developer','client')", name="ck_user_role"),
        CheckConstraint("access_level IN ('read','write')", name="ck_user_access_level"),
        CheckConstraint("is_enabled IN (0,1)", name="ck_user_is_enabled"),
        CheckConstraint("is_primary_admin IN (0,1)", name="ck_user_is_primary_admin"),
        CheckConstraint(
            "must_change_password IN (0,1)", name="ck_user_must_change_password"
        ),
    )
