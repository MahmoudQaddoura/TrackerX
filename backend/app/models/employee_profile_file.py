from __future__ import annotations

"""Private CV and supporting profile files for one TrackerX employee."""

from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso


class EmployeeProfileFile(Base):
    __tablename__ = "employee_profile_files"

    id = Column(Integer, primary_key=True)
    team_member_id = Column(
        Integer,
        ForeignKey("team_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_name = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    content_type = Column(Text, nullable=True)
    file_size = Column(Integer, nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)

    team_member = relationship("TeamMember", back_populates="profile_files")
    uploaded_by = relationship("User")
