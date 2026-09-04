from __future__ import annotations

"""Structured Maintenance & Support records and employee assignments."""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Table, Text
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

PROACTIVE_CATEGORIES = (
    "health_check",
    "patch_update",
    "penetration_testing",
    "updates",
    "performance",
    "kpi",
)
PROACTIVE_STATUSES = ("pending", "in_progress", "completed", "attention_required")
INCIDENT_STATUSES = ("reported", "investigating", "resolved", "unresolved")
INCIDENT_SEVERITIES = ("low", "medium", "high", "critical")

PROACTIVE_CATEGORY_TEMPLATES = (
    ("health_check", "Health Check Report"),
    ("patch_update", "Patch Update Report"),
    ("penetration_testing", "Penetration Testing Report"),
    ("updates", "System Updates Report"),
    ("performance", "Performance Report"),
    ("kpi", "KPI Report"),
)

proactive_report_assignees = Table(
    "proactive_report_assignees",
    Base.metadata,
    Column(
        "report_id",
        ForeignKey("proactive_service_reports.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "team_member_id",
        ForeignKey("team_members.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

support_incident_assignees = Table(
    "support_incident_assignees",
    Base.metadata,
    Column(
        "incident_id",
        ForeignKey("support_incidents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "team_member_id",
        ForeignKey("team_members.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class ProactiveServiceReport(Base):
    __tablename__ = "proactive_service_reports"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category = Column(Text, nullable=False, index=True)
    service_area_name = Column(Text, nullable=True)
    title = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="pending", index=True)
    period_start = Column(Text, nullable=True)
    period_end = Column(Text, nullable=True)
    due_date = Column(Text, nullable=True)
    executive_summary = Column(Text, nullable=True)
    findings = Column(Text, nullable=True)
    work_completed = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    next_action_date = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    project = relationship("Project", back_populates="proactive_reports")
    created_by = relationship("User")
    assignees = relationship(
        "TeamMember",
        secondary=proactive_report_assignees,
        order_by="TeamMember.name",
    )

    __table_args__ = (
        CheckConstraint(
            "category IN ('health_check','patch_update','penetration_testing','updates','performance','kpi')",
            name="ck_proactive_report_category",
        ),
        CheckConstraint(
            "status IN ('pending','in_progress','completed','attention_required')",
            name="ck_proactive_report_status",
        ),
    )


class SupportIncident(Base):
    __tablename__ = "support_incidents"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(Text, nullable=False)
    client_report = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    reported_at = Column(Text, nullable=False)
    severity = Column(Text, nullable=False, default="medium", index=True)
    recommendation = Column(Text, nullable=True)
    investigation = Column(Text, nullable=True)
    response_at = Column(Text, nullable=True)
    response_description = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="reported", index=True)
    resolution_notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    project = relationship("Project", back_populates="support_incidents")
    created_by = relationship("User")
    assignees = relationship(
        "TeamMember",
        secondary=support_incident_assignees,
        order_by="TeamMember.name",
    )

    __table_args__ = (
        CheckConstraint(
            "severity IN ('low','medium','high','critical')",
            name="ck_support_incident_severity",
        ),
        CheckConstraint(
            "status IN ('reported','investigating','resolved','unresolved')",
            name="ck_support_incident_status",
        ),
    )
