from __future__ import annotations

"""Client accounts, project visibility, and explicitly forwarded reports."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, func, insert
from sqlalchemy.orm import Session

from app.db import get_db, now_iso
from app.deps import get_current_user, require_admin
from app.models import (
    ClientProfile,
    ClientReportShare,
    Project,
    ProactiveServiceReport,
    SupportIncident,
    User,
    project_clients,
)
from app.schemas.client import (
    ClientCreateInput,
    ClientPortalOut,
    ClientProfileOut,
    ClientProjectAssignmentInput,
    ClientReportShareInput,
    ClientReportShareOut,
    ClientUpdateInput,
    ShareableReportOut,
)
from app.security import hash_password
from app.services.serialize import project_out
from app.services.support_report_pdf import build_incident_report_pdf, build_proactive_report_pdf

router = APIRouter(tags=["clients"])


def _client_or_404(db: Session, client_id: int) -> User:
    client = db.get(User, client_id)
    if client is None or client.role != "client":
        raise HTTPException(status_code=404, detail="Client not found.")
    return client


def _client_projects(db: Session, client_id: int) -> list[Project]:
    return (
        db.query(Project)
        .join(project_clients, project_clients.c.project_id == Project.id)
        .filter(project_clients.c.user_id == client_id)
        .order_by(Project.name)
        .all()
    )


def _client_project_out(project: Project) -> dict:
    data = project_out(project)
    return {
        key: data[key]
        for key in (
            "id",
            "name",
            "description",
            "status",
            "project_type",
            "parent_project_id",
            "start_date",
            "end_date",
            "progress_pct",
            "total_tasks",
            "done_tasks",
            "is_delayed",
        )
    }


def _profile_out(db: Session, client: User, include_notes: bool = True) -> dict:
    profile = client.client_profile
    projects = _client_projects(db, client.id)
    shares = (
        db.query(ClientReportShare)
        .filter(ClientReportShare.client_user_id == client.id)
        .order_by(ClientReportShare.shared_at.desc())
        .all()
    )
    return {
        "id": client.id,
        "email": client.email,
        "full_name": client.full_name,
        "organization": profile.organization if profile else None,
        "job_title": profile.job_title if profile else None,
        "phone": profile.phone if profile else None,
        "notes": profile.notes if profile and include_notes else None,
        "is_enabled": bool(client.is_enabled),
        "must_change_password": bool(client.must_change_password),
        "projects": [_client_project_out(project) for project in projects],
        "shared_report_count": len(shares),
        "unread_report_count": sum(1 for share in shares if not share.read_at),
        "last_shared_at": shares[0].shared_at if shares else None,
        "created_at": client.created_at,
    }


def _proactive_payload(report: ProactiveServiceReport) -> dict:
    return {
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
        "updated_at": report.updated_at,
    }


def _incident_payload(incident: SupportIncident) -> dict:
    return {
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
        "updated_at": incident.updated_at,
    }


def _share_out(share: ClientReportShare) -> dict:
    if share.proactive_report is not None:
        report_type = "proactive"
        report_id = share.proactive_report.id
        title = share.proactive_report.title
        status = share.proactive_report.status
        category = share.proactive_report.category
        report = _proactive_payload(share.proactive_report)
    elif share.incident is not None:
        report_type = "incident"
        report_id = share.incident.id
        title = share.incident.title
        status = share.incident.status
        category = None
        report = _incident_payload(share.incident)
    else:
        raise HTTPException(status_code=410, detail="The forwarded report is no longer available.")
    project = share.project
    context_project = project.parent_project if project and project.parent_project else project
    return {
        "id": share.id,
        "client_user_id": share.client_user_id,
        "project_id": context_project.id if context_project else share.project_id,
        "project_name": context_project.name if context_project else "Project",
        "report_type": report_type,
        "report_id": report_id,
        "title": title,
        "status": status,
        "category": category,
        "message": share.message,
        "shared_by_name": share.shared_by.full_name if share.shared_by else None,
        "shared_at": share.shared_at,
        "read_at": share.read_at,
        "report": report,
    }


def _allowed_report_project_ids(db: Session, client_id: int) -> set[int]:
    direct_ids = {project.id for project in _client_projects(db, client_id)}
    support_ids = {
        row[0]
        for row in db.query(Project.id)
        .filter(Project.project_type == "maintenance_support")
        .filter(Project.parent_project_id.in_(direct_ids))
        .all()
    } if direct_ids else set()
    return direct_ids | support_ids


def _set_projects(db: Session, client_id: int, project_ids: list[int]) -> None:
    unique_ids = list(dict.fromkeys(project_ids))
    if unique_ids:
        found_ids = {
            row[0] for row in db.query(Project.id).filter(Project.id.in_(unique_ids)).all()
        }
        if found_ids != set(unique_ids):
            raise HTTPException(status_code=422, detail="One or more selected projects do not exist.")
    db.execute(delete(project_clients).where(project_clients.c.user_id == client_id))
    if unique_ids:
        db.execute(
            insert(project_clients),
            [{"user_id": client_id, "project_id": project_id} for project_id in unique_ids],
        )


@router.get("/clients", response_model=list[ClientProfileOut])
def list_clients(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    clients = db.query(User).filter(User.role == "client").order_by(User.full_name).all()
    return [_profile_out(db, client) for client in clients]


@router.post("/clients", response_model=ClientProfileOut, status_code=201)
def create_client(
    inp: ClientCreateInput,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    email = inp.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first() is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    client = User(
        email=email,
        full_name=inp.full_name.strip(),
        role="client",
        access_level="read",
        is_enabled=1,
        must_change_password=1,
        hashed_password=hash_password(inp.temporary_password),
    )
    db.add(client)
    db.flush()
    client.client_profile = ClientProfile(
        organization=inp.organization,
        job_title=inp.job_title,
        phone=inp.phone,
        notes=inp.notes,
    )
    _set_projects(db, client.id, inp.project_ids)
    db.commit()
    db.refresh(client)
    return _profile_out(db, client)


@router.get("/clients/{client_id}", response_model=ClientProfileOut)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return _profile_out(db, _client_or_404(db, client_id))


@router.put("/clients/{client_id}", response_model=ClientProfileOut)
def update_client(
    client_id: int,
    inp: ClientUpdateInput,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    client = _client_or_404(db, client_id)
    data = inp.model_dump(exclude_unset=True)
    if "email" in data:
        email = str(data.pop("email")).lower()
        duplicate = (
            db.query(User)
            .filter(func.lower(User.email) == email, User.id != client.id)
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="A user with this email already exists.")
        client.email = email
    if "full_name" in data:
        client.full_name = data.pop("full_name").strip()
    if "is_enabled" in data:
        client.is_enabled = int(data.pop("is_enabled"))
    temporary_password = data.pop("temporary_password", None)
    if temporary_password:
        client.hashed_password = hash_password(temporary_password)
        client.must_change_password = 1
    profile = client.client_profile
    if profile is None:
        profile = ClientProfile(user_id=client.id)
        db.add(profile)
    for field in ("organization", "job_title", "phone", "notes"):
        if field in data:
            setattr(profile, field, data[field])
    db.commit()
    db.refresh(client)
    return _profile_out(db, client)


@router.put("/clients/{client_id}/projects", response_model=ClientProfileOut)
def assign_client_projects(
    client_id: int,
    inp: ClientProjectAssignmentInput,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    client = _client_or_404(db, client_id)
    _set_projects(db, client.id, inp.project_ids)
    db.commit()
    db.refresh(client)
    return _profile_out(db, client)


@router.get("/clients/{client_id}/shareable-reports", response_model=list[ShareableReportOut])
def list_shareable_reports(
    client_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    client = _client_or_404(db, client_id)
    allowed_ids = _allowed_report_project_ids(db, client.id)
    if not allowed_ids:
        return []
    existing_proactive = {
        row[0]
        for row in db.query(ClientReportShare.proactive_report_id)
        .filter(
            ClientReportShare.client_user_id == client.id,
            ClientReportShare.proactive_report_id.is_not(None),
        )
        .all()
    }
    existing_incidents = {
        row[0]
        for row in db.query(ClientReportShare.incident_id)
        .filter(
            ClientReportShare.client_user_id == client.id,
            ClientReportShare.incident_id.is_not(None),
        )
        .all()
    }
    proactive = (
        db.query(ProactiveServiceReport)
        .filter(
            ProactiveServiceReport.project_id.in_(allowed_ids),
            ProactiveServiceReport.status == "completed",
        )
        .all()
    )
    incidents = (
        db.query(SupportIncident)
        .filter(
            SupportIncident.project_id.in_(allowed_ids),
            SupportIncident.status.in_(("resolved", "unresolved")),
        )
        .all()
    )
    rows = [
        {
            "report_type": "proactive",
            "report_id": report.id,
            "project_id": report.project.parent_project_id or report.project_id,
            "project_name": report.project.parent_project.name
            if report.project.parent_project
            else report.project.name,
            "title": report.title,
            "status": report.status,
            "category": report.category,
            "date": report.period_end or report.updated_at,
            "already_shared": report.id in existing_proactive,
        }
        for report in proactive
    ]
    rows.extend(
        {
            "report_type": "incident",
            "report_id": incident.id,
            "project_id": incident.project.parent_project_id or incident.project_id,
            "project_name": incident.project.parent_project.name
            if incident.project.parent_project
            else incident.project.name,
            "title": incident.title,
            "status": incident.status,
            "category": None,
            "date": incident.response_at or incident.reported_at,
            "already_shared": incident.id in existing_incidents,
        }
        for incident in incidents
    )
    return sorted(rows, key=lambda row: row["date"] or "", reverse=True)


@router.get("/clients/{client_id}/report-shares", response_model=list[ClientReportShareOut])
def list_client_report_shares(
    client_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    client = _client_or_404(db, client_id)
    shares = (
        db.query(ClientReportShare)
        .filter(ClientReportShare.client_user_id == client.id)
        .order_by(ClientReportShare.shared_at.desc())
        .all()
    )
    return [_share_out(share) for share in shares]


@router.post("/clients/{client_id}/report-shares", response_model=ClientReportShareOut, status_code=201)
def forward_report(
    client_id: int,
    inp: ClientReportShareInput,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = _client_or_404(db, client_id)
    allowed_ids = _allowed_report_project_ids(db, client.id)
    share = ClientReportShare(
        client_user_id=client.id,
        shared_by_id=admin.id,
        message=inp.message,
    )
    if inp.report_type == "proactive":
        report = db.get(ProactiveServiceReport, inp.report_id)
        if report is None:
            raise HTTPException(status_code=404, detail="Proactive report not found.")
        if report.project_id not in allowed_ids:
            raise HTTPException(status_code=422, detail="This report is outside the client's projects.")
        if report.status != "completed":
            raise HTTPException(status_code=422, detail="Only completed reports can be forwarded.")
        duplicate = db.query(ClientReportShare).filter(
            ClientReportShare.client_user_id == client.id,
            ClientReportShare.proactive_report_id == report.id,
        ).first()
        share.project_id = report.project_id
        share.proactive_report_id = report.id
    else:
        incident = db.get(SupportIncident, inp.report_id)
        if incident is None:
            raise HTTPException(status_code=404, detail="Incident report not found.")
        if incident.project_id not in allowed_ids:
            raise HTTPException(status_code=422, detail="This report is outside the client's projects.")
        if incident.status not in ("resolved", "unresolved"):
            raise HTTPException(status_code=422, detail="Only closed incident reports can be forwarded.")
        duplicate = db.query(ClientReportShare).filter(
            ClientReportShare.client_user_id == client.id,
            ClientReportShare.incident_id == incident.id,
        ).first()
        share.project_id = incident.project_id
        share.incident_id = incident.id
    if duplicate:
        raise HTTPException(status_code=409, detail="This report has already been forwarded to the client.")
    db.add(share)
    db.commit()
    db.refresh(share)
    return _share_out(share)


@router.delete("/client-report-shares/{share_id}", status_code=204)
def revoke_report_share(
    share_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    share = db.get(ClientReportShare, share_id)
    if share is None:
        raise HTTPException(status_code=404, detail="Forwarded report not found.")
    db.delete(share)
    db.commit()


@router.get("/client/portal", response_model=ClientPortalOut)
def client_portal(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "client":
        raise HTTPException(status_code=403, detail="This area is for client accounts.")
    shares = (
        db.query(ClientReportShare)
        .filter(ClientReportShare.client_user_id == user.id)
        .order_by(ClientReportShare.shared_at.desc())
        .all()
    )
    return {
        "profile": _profile_out(db, user, include_notes=False),
        "reports": [_share_out(share) for share in shares],
    }


@router.patch("/client/reports/{share_id}/read", response_model=ClientReportShareOut)
def mark_report_read(
    share_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "client":
        raise HTTPException(status_code=403, detail="This area is for client accounts.")
    share = db.get(ClientReportShare, share_id)
    if share is None or share.client_user_id != user.id:
        raise HTTPException(status_code=404, detail="Forwarded report not found.")
    if not share.read_at:
        share.read_at = now_iso()
        db.commit()
        db.refresh(share)
    return _share_out(share)


@router.get("/client/reports/{share_id}/export/pdf")
def export_forwarded_report_pdf(
    share_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "client":
        raise HTTPException(status_code=403, detail="This area is for client accounts.")
    share = db.get(ClientReportShare, share_id)
    if share is None or share.client_user_id != user.id:
        raise HTTPException(status_code=404, detail="Forwarded report not found.")
    prepared_by = share.shared_by.full_name if share.shared_by else "TrackerX Administration"
    if share.proactive_report is not None:
        pdf = build_proactive_report_pdf(share.proactive_report, prepared_by=prepared_by)
        report_id = share.proactive_report.id
        prefix = "service-report"
    elif share.incident is not None:
        pdf = build_incident_report_pdf(share.incident, prepared_by=prepared_by)
        report_id = share.incident.id
        prefix = "incident-report"
    else:
        raise HTTPException(status_code=410, detail="The forwarded report is no longer available.")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{prefix}-{report_id:04d}.pdf"'},
    )
