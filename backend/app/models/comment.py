"""
models/comment.py
A comment on a task or milestone. Polymorphic via (entity_type, entity_id) —
no FK, so a single table serves both. Both PMs and owners may post comments
(owner feedback works like a client leaving notes for the PM).
"""

from sqlalchemy import CheckConstraint, Column, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

COMMENT_ENTITY_TYPES = ("task", "milestone")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    entity_type = Column(Text, nullable=False)  # 'task' | 'milestone'
    entity_id = Column(Integer, nullable=False, index=True)
    author_id = Column(Integer, nullable=False)  # users.id (kept as plain int)
    body = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    # author_id references users.id; the relationship uses an explicit primaryjoin
    # because there is no ForeignKey column (comments are intentionally lightweight).
    author = relationship(
        "User",
        primaryjoin="foreign(Comment.author_id) == User.id",
        viewonly=True,
    )

    __table_args__ = (
        CheckConstraint("entity_type IN ('task','milestone')", name="ck_comment_entity_type"),
    )
