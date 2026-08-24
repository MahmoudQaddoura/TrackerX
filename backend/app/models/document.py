from __future__ import annotations

"""
models/document.py
File metadata. The bytes live on disk (file_path); the DB stores metadata only.
A document belongs to a project and optionally to a milestone, filed under one
of three fixed categories.
"""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

DOCUMENT_CATEGORIES = ("technical", "meeting_minutes", "business")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    milestone_id = Column(
        Integer, ForeignKey("milestones.id", ondelete="CASCADE"), index=True, nullable=True
    )
    category = Column(Text, nullable=False, index=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    file_name = Column(Text, nullable=False)  # original filename
    # Portable path relative to DOCUMENTS_DIR. Legacy absolute values are
    # normalized on startup and remain readable during migration.
    file_path = Column(Text, nullable=False)
    content_type = Column(Text, nullable=True)
    file_size = Column(Integer, nullable=True)  # bytes
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    project = relationship("Project", back_populates="documents")
    milestone = relationship("Milestone", back_populates="documents")

    __table_args__ = (
        CheckConstraint(
            "category IN ('technical','meeting_minutes','business')", name="ck_document_category"
        ),
    )
