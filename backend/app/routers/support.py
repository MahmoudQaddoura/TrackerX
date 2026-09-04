from __future__ import annotations

"""Structured proactive reporting and reactive incident workflows."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import (
    check_project_access,
    get_current_user,
    require_manager,
    require_project_access,
    require_project_content_editor,
)
from app.models import Project, ProactiveServiceReport, SupportIncident, TeamMember, User
from app.models.support import (
    INCIDENT_SEVERITIES,
    INCIDENT_DETECTION_SOURCES,
    INCIDENT_STATUSES,
    PROACTIVE_CATEGORIES,
    PROACTIVE_STATUSES,
)
from app.schemas.support import (
    ProactiveReportInput,
    ProactiveReportOut,
    ProactiveReportUpdate,
    SupportIncidentInput,
    SupportIncidentOut,
    SupportIncidentUpdate,
)
from app.services.support_report_pdf import build_incident_report_pdf, build_proactive_report_pdf

router = APIRouter(tags=["maintenance-support"])


def _assert_support(project: Project) -> None:
    if project.project_type != "maintenance_support":
        raise HTTPException(
            status_code=422,
            detail="Service records are available only in Maintenance & Support workspaces.",
        )


def _resolve_assignees(db: Session, member_ids: list[int]) -> list[TeamMember]:
    unique_ids = list(dict.fromkeys(member_ids))
    if not unique_ids:
        return []
    members = db.query(TeamMember).filter(TeamMember.id.in_(unique_ids)).all()
    by_id = {member.id: member for member in members}
    if any(member_id not in by_id for member_id in unique_ids):
        raise HTTPException(status_code=422, detail="One or more assignees do not exist.")
    if any(not bool(member.is_active) for member in members):
        raise HTTPException(status_code=422, detail="Inactive employees cannot be assigned.")
    return [by_id[member_id] for member_id in unique_ids]


def _can_assign(user: User) -> bool:
    return user.role in ("admin", "pm")


def _validate_report(data: dict, existing: ProactiveServiceReport | None = None) -> None:
    category = data.get("category", existing.category if existing else None)
    status = data.get("status", existing.status if existing else None)
    period_start = data.get("period_start", existing.period_start if existing else None)
    period_end = data.get("period_end", existing.period_end if existing else None)
    if category not in PROACTIVE_CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid proactive report category.")
    service_area_name = data.get(
        "service_area_name", existing.service_area_name if existing else None
    )
    if service_area_name is not None and not service_area_name.strip():
        raise HTTPException(status_code=422, detail="Custom service name cannot be blank.")
    if status not in PROACTIVE_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid proactive report status.")
    if period_start and period_end and period_start > period_end:
        raise HTTPException(status_code=422, detail="Report period start must precede its end.")
    if status == "completed":
        required_fields = ("executive_summary", "findings", "work_completed", "recommendations")
        missing = [
            field
            for field in required_fields
            if not data.get(field, getattr(existing, field, None) if existing else None)
        ]
        if missing:
            raise HTTPException(
                status_code=422,
                detail="A completed report needs a summary, findings, completed work, and recommendations.",
            )


def _validate_incident(data: dict, existing: SupportIncident | None = None) -> None:
    status = data.get("status", existing.status if existing else None)
    severity = data.get("severity", existing.severity if existing else None)
    detection_source = data.get(
        "detection_source", existing.detection_source if existing else "team"
    )
    reported_at = data.get("reported_at", existing.reported_at if existing else None)
    response_at = data.get("response_at", existing.response_at if existing else None)
    if status not in INCIDENT_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid incident status.")
    if severity not in INCIDENT_SEVERITIES:
        raise HTTPException(status_code=422, detail="Invalid incident severity.")
    if detection_source not in INCIDENT_DETECTION_SOURCES:
        raise HTTPException(status_code=422, detail="Invalid incident detection source.")
    if not reported_at:
        raise HTTPException(status_code=422, detail="Incident report time is required.")
    if existing is None:
        required_triage = ("reported_by_name", "affected_service", "client_report", "description")
        if any(not data.get(field) for field in required_triage):
            raise HTTPException(
                status_code=422,
                detail="A new incident needs its detection source, affected service, initial evidence, and impact.",
            )
    if response_at and response_at < reported_at:
        raise HTTPException(status_code=422, detail="Response time cannot precede report time.")
    if status in ("resolved", "unresolved"):
        required_fields = (
            "investigation",
            "response_at",
            "response_description",
            "resolution_notes",
        )
        missing = [
            field
            for field in required_fields
            if not data.get(field, getattr(existing, field, None) if existing else None)
        ]
        if missing:
            raise HTTPException(
                status_code=422,
                detail="A closed incident needs investigation, response time, response details, and resolution notes.",
            )


def _report_out(report: ProactiveServiceReport) -> dict:
    return {
        "id": report.id,
        "project_id": report.project_id,
        "category": report.category,
        "service_area_name": report.service_area_name,
        "title": report.title,
        "status": report.status,
        "period_start": report.period_start,
        "period_end": report.period_end,
        "due_date": report.due_date,
        "executive_summary": report.executive_summary,
        "findings": report.findings,
        "work_completed": report.work_completed,
        "recommendations": report.recommendations,
        "next_action_date": report.next_action_date,
        "assigned_members": [
            {"id": member.id, "name": member.name, "role": member.role}
            for member in report.assignees
        ],
        "created_by_name": report.created_by.full_name if report.created_by else None,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


def _incident_out(incident: SupportIncident) -> dict:
    return {
        "id": incident.id,
        "project_id": incident.project_id,
        "title": incident.title,
        "detection_source": incident.detection_source,
        "reported_by_name": incident.reported_by_name,
        "affected_service": incident.affected_service,
        "client_report": incident.client_report,
        "reason": incident.reason,
        "description": incident.description,
        "reported_at": incident.reported_at,
        "severity": incident.severity,
        "recommendation": incident.recommendation,
        "containment_actions": incident.containment_actions,
        "investigation": incident.investigation,
        "root_cause": incident.root_cause,
        "response_at": incident.response_at,
        "response_description": incident.response_description,
        "recovery_validation": incident.recovery_validation,
        "status": incident.status,
        "resolution_notes": incident.resolution_notes,
        "lessons_learned": incident.lessons_learned,
        "assigned_members": [
            {"id": member.id, "name": member.name, "role": member.role}
            for member in incident.assignees
        ],
        "created_by_name": incident.created_by.full_name if incident.created_by else None,
        "created_at": incident.created_at,
        "updated_at": incident.updated_at,
    }


@router.get(
    "/projects/{project_id}/support/proactive",
    response_model=list[ProactiveReportOut],
)
def list_proactive_reports(
    project: Project = Depends(require_project_access),
    user: User = Depends(get_current_user),
):
    _assert_support(project)
    if user.role == "client":
        raise HTTPException(status_code=403, detail="Clients can access only reports forwarded by an admin.")
    rows = sorted(project.proactive_reports, key=lambda report: (report.id, report.created_at))
    return [_report_out(report) for report in rows]


@router.post(
    "/projects/{project_id}/support/proactive",
    response_model=ProactiveReportOut,
    status_code=201,
)
def create_proactive_report(
    project_id: int,
    inp: ProactiveReportInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    _assert_support(project)
    data = inp.model_dump()
    assignee_ids = data.pop("assigned_member_ids")
    if assignee_ids and not _can_assign(user):
        raise HTTPException(status_code=403, detail="Only an admin or project manager can assign employees.")
    _validate_report(data)
    report = ProactiveServiceReport(project_id=project_id, created_by_id=user.id, **data)
    report.assignees = _resolve_assignees(db, assignee_ids)
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_out(report)


@router.put("/support/proactive/{report_id}", response_model=ProactiveReportOut)
def update_proactive_report(
    report_id: int,
    inp: ProactiveReportUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    report = db.get(ProactiveServiceReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Proactive report not found.")
    check_project_access(db, user, report.project_id)
    _assert_support(report.project)
    data = inp.model_dump(exclude_unset=True)
    assignee_ids = data.pop("assigned_member_ids", None)
    if assignee_ids is not None and not _can_assign(user):
        raise HTTPException(status_code=403, detail="Only an admin or project manager can assign employees.")
    _validate_report(data, report)
    for field, value in data.items():
        setattr(report, field, value)
    if assignee_ids is not None:
        report.assignees = _resolve_assignees(db, assignee_ids)
    db.commit()
    db.refresh(report)
    return _report_out(report)


@router.delete("/support/proactive/{report_id}", status_code=204)
def delete_proactive_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    report = db.get(ProactiveServiceReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Proactive report not found.")
    check_project_access(db, user, report.project_id)
    db.delete(report)
    db.commit()


@router.get("/support/proactive/{report_id}/export/pdf")
def export_proactive_report_pdf(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    report = db.get(ProactiveServiceReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Proactive report not found.")
    if user.role == "client":
        raise HTTPException(status_code=403, detail="Clients can download only forwarded reports.")
    check_project_access(db, user, report.project_id)
    pdf = build_proactive_report_pdf(report, prepared_by=user.full_name)
    filename = f"service-report-{report.id:04d}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/projects/{project_id}/support/incidents",
    response_model=list[SupportIncidentOut],
)
def list_support_incidents(
    project: Project = Depends(require_project_access),
    user: User = Depends(get_current_user),
):
    _assert_support(project)
    if user.role == "client":
        raise HTTPException(status_code=403, detail="Clients can access only reports forwarded by an admin.")
    rows = sorted(project.support_incidents, key=lambda incident: incident.reported_at, reverse=True)
    return [_incident_out(incident) for incident in rows]


@router.post(
    "/projects/{project_id}/support/incidents",
    response_model=SupportIncidentOut,
    status_code=201,
)
def create_support_incident(
    project_id: int,
    inp: SupportIncidentInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    _assert_support(project)
    data = inp.model_dump()
    assignee_ids = data.pop("assigned_member_ids")
    if assignee_ids and not _can_assign(user):
        raise HTTPException(status_code=403, detail="Only an admin or project manager can assign employees.")
    _validate_incident(data)
    incident = SupportIncident(project_id=project_id, created_by_id=user.id, **data)
    incident.assignees = _resolve_assignees(db, assignee_ids)
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return _incident_out(incident)


@router.put("/support/incidents/{incident_id}", response_model=SupportIncidentOut)
def update_support_incident(
    incident_id: int,
    inp: SupportIncidentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    incident = db.get(SupportIncident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Support incident not found.")
    check_project_access(db, user, incident.project_id)
    _assert_support(incident.project)
    data = inp.model_dump(exclude_unset=True)
    assignee_ids = data.pop("assigned_member_ids", None)
    if assignee_ids is not None and not _can_assign(user):
        raise HTTPException(status_code=403, detail="Only an admin or project manager can assign employees.")
    _validate_incident(data, incident)
    for field, value in data.items():
        setattr(incident, field, value)
    if assignee_ids is not None:
        incident.assignees = _resolve_assignees(db, assignee_ids)
    db.commit()
    db.refresh(incident)
    return _incident_out(incident)


@router.delete("/support/incidents/{incident_id}", status_code=204)
def delete_support_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    incident = db.get(SupportIncident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Support incident not found.")
    check_project_access(db, user, incident.project_id)
    db.delete(incident)
    db.commit()


@router.get("/support/incidents/{incident_id}/export/pdf")
def export_incident_report_pdf(
    incident_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    incident = db.get(SupportIncident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Support incident not found.")
    if user.role == "client":
        raise HTTPException(status_code=403, detail="Clients can download only forwarded reports.")
    check_project_access(db, user, incident.project_id)
    pdf = build_incident_report_pdf(incident, prepared_by=user.full_name)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="incident-report-{incident.id:04d}.pdf"'},
    )
