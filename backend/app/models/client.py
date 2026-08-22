from __future__ import annotations

"""Client profiles and explicitly forwarded client-facing reports."""

from sqlalchemy import Column, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base, now_iso


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    organization = Column(Text, nullable=True)
    job_title = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    user = relationship("User", back_populates="client_profile")


class ClientReportShare(Base):
    __tablename__ = "client_report_shares"

    id = Column(Integer, primary_key=True)
    client_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    proactive_report_id = Column(
        Integer,
        ForeignKey("proactive_service_reports.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    incident_id = Column(
        Integer,
        ForeignKey("support_incidents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    shared_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    message = Column(Text, nullable=True)
    shared_at = Column(Text, nullable=False, default=now_iso)
    read_at = Column(Text, nullable=True)

    client = relationship("User", foreign_keys=[client_user_id], back_populates="report_shares")
    shared_by = relationship("User", foreign_keys=[shared_by_id])
    project = relationship("Project")
    proactive_report = relationship("ProactiveServiceReport")
    incident = relationship("SupportIncident")

    __table_args__ = (
        UniqueConstraint(
            "client_user_id",
            "proactive_report_id",
            name="uq_client_proactive_report_share",
        ),
        UniqueConstraint(
            "client_user_id",
            "incident_id",
            name="uq_client_incident_share",
        ),
    )
