from __future__ import annotations

"""Project-scoped Excel templates, exports, previews, and atomic imports."""

import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import (
    check_project_access,
    get_current_user,
    require_manager,
    require_project_access,
    require_project_content_editor,
    require_project_manage_access,
)
from app.models import Asset, AssetConnection, AssetPort, Milestone, Project, Task, User
from app.models.asset import ASSET_ENVIRONMENTS, CONNECTION_STATUSES
from app.services.asset_excel_import import import_asset_excel
from app.services.asset_inventory_excel import build_asset_inventory_excel
from app.services.kanban_excel import build_kanban_excel
from app.services.kanban_excel_import import import_kanban_excel
from app.services.ooxml_workbook import WorkbookFormatError, XLSX_MIME
from app.services.serialize import milestone_out, task_out


router = APIRouter(tags=["excel"])
MAX_XLSX_BYTES = 8 * 1024 * 1024


def _filename(project: Project, suffix: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", project.name.casefold()).strip("-")
    return f"trackerx-{slug or f'project-{project.id}'}-{suffix}.xlsx"


def _download(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _read_upload(file: UploadFile) -> bytes:
    filename = (file.filename or "").strip()
    if not filename.casefold().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="Upload an Excel .xlsx workbook.")
    raw = await file.read(MAX_XLSX_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=422, detail="Uploaded workbook is empty.")
    if len(raw) > MAX_XLSX_BYTES:
        raise HTTPException(status_code=413, detail="Workbook exceeds the 8 MB upload limit.")
    return raw


def _kanban_export_data(db: Session, project: Project) -> tuple[list[dict], list[dict]]:
    milestones = (
        db.query(Milestone)
        .options(selectinload(Milestone.tasks).selectinload(Task.assigned_members))
        .filter(Milestone.project_id == project.id, Milestone.workstream == "project")
        .order_by(Milestone.sort_order, Milestone.id)
        .all()
    )
    milestone_rows = [milestone_out(item) for item in milestones]
    task_rows: list[dict] = []
    for milestone in milestones:
        for task in sorted(milestone.tasks, key=lambda item: (item.sort_order, item.id)):
            item = task_out(task)
            member_by_id = {member.id: member for member in task.assigned_members}
            for member in item["assigned_members"]:
                record = member_by_id.get(member["id"])
                member["employee_number"] = record.employee_number if record else None
            task_rows.append(item)
    return milestone_rows, task_rows


@router.get("/projects/{project_id}/kanban/excel")
def export_kanban_excel(
    project: Project = Depends(require_project_access),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if project.project_type != "actual_project":
        raise HTTPException(status_code=422, detail="Kanban Excel is available for actual projects.")
    milestones, tasks = _kanban_export_data(db, project)
    workbook = build_kanban_excel(
        project_id=project.id,
        project_name=project.name,
        milestones=milestones,
        tasks=tasks,
        exported_by=user.full_name,
    )
    return _download(workbook, _filename(project, "kanban"))


@router.get("/projects/{project_id}/kanban/excel-template")
def download_kanban_template(
    project: Project = Depends(require_project_manage_access),
    user: User = Depends(require_manager),
):
    workbook = build_kanban_excel(
        project_id=project.id,
        project_name=project.name,
        milestones=[],
        tasks=[],
        exported_by=user.full_name,
        template=True,
    )
    return _download(workbook, _filename(project, "kanban-template"))


@router.post("/projects/{project_id}/kanban/import-excel")
async def upload_kanban_excel(
    project: Project = Depends(require_project_manage_access),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
    file: UploadFile = File(...),
    commit: bool = Form(False),
):
    raw = await _read_upload(file)
    try:
        result = import_kanban_excel(db, project=project, user=user, raw=raw, commit=commit)
    except WorkbookFormatError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if commit and not result["valid"]:
        raise HTTPException(status_code=422, detail={"message": "Workbook validation failed.", "errors": result["errors"]})
    return result


def _asset_export_data(db: Session, project_id: int) -> tuple[list[dict], list[dict]]:
    assets = (
        db.query(Asset)
        .options(selectinload(Asset.ports), selectinload(Asset.created_by))
        .filter(Asset.project_id == project_id)
        .order_by(Asset.environment, Asset.hostname)
        .all()
    )
    asset_ids = [asset.id for asset in assets]
    port_ids = [port.id for asset in assets for port in asset.ports]
    connections = (
        db.query(AssetConnection)
        .options(
            selectinload(AssetConnection.source_asset),
            selectinload(AssetConnection.port_record).selectinload(AssetPort.asset),
        )
        .filter(AssetConnection.source_asset_id.in_(asset_ids), AssetConnection.port_id.in_(port_ids))
        .all()
        if asset_ids and port_ids
        else []
    )
    asset_rows = [
        {
            "id": asset.id,
            "hostname": asset.hostname,
            "ip_address": asset.ip_address,
            "environment": asset.environment,
            "purpose": asset.purpose,
            "tier": asset.tier,
            "os": asset.os,
            "cpu": asset.cpu,
            "ram": asset.ram,
            "storage": asset.storage,
            "applications": asset.applications,
            "database": asset.database,
            "services": asset.services,
            "status": asset.status,
            "notes": asset.notes,
            "ports": [
                {
                    "id": port.id,
                    "port": port.port,
                    "protocol": port.protocol,
                    "service": port.service,
                    "notes": port.notes,
                    "created_at": port.created_at,
                    "updated_at": port.updated_at,
                }
                for port in asset.ports
            ],
            "created_by_name": asset.created_by.full_name if asset.created_by else None,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
        }
        for asset in assets
    ]
    connection_rows = [
        {
            "id": item.id,
            "source_asset_id": item.source_asset_id,
            "source_hostname": item.source_asset.hostname,
            "source_ip_address": item.source_asset.ip_address,
            "destination_asset_id": item.port_record.asset_id,
            "destination_hostname": item.port_record.asset.hostname,
            "destination_ip_address": item.port_record.asset.ip_address,
            "port_id": item.port_id,
            "port": item.port_record.port,
            "protocol": item.port_record.protocol,
            "service": item.port_record.service,
            "status": item.status,
            "updated_at": item.updated_at,
        }
        for item in connections
    ]
    return asset_rows, connection_rows


@router.get("/projects/{project_id}/assets/excel-template")
def download_asset_template(
    project: Project = Depends(require_project_access),
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    check_project_access(db, user, project.id)
    workbook = build_asset_inventory_excel(
        project_id=project.id,
        project_name=project.name,
        project_type=project.project_type,
        assets=[],
        connections=[],
        exported_by=user.full_name,
    )
    return _download(workbook, _filename(project, "asset-inventory-template"))


@router.post("/projects/{project_id}/assets/import-excel")
async def upload_asset_excel(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
    file: UploadFile = File(...),
    commit: bool = Form(False),
    default_environment: str = Form("other"),
    default_connection_status: str = Form("connected"),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    if default_environment not in ASSET_ENVIRONMENTS:
        raise HTTPException(status_code=422, detail="Choose a valid default asset environment.")
    if default_connection_status not in CONNECTION_STATUSES:
        raise HTTPException(status_code=422, detail="Choose a valid default connection status.")
    raw = await _read_upload(file)
    try:
        result = import_asset_excel(
            db,
            project=project,
            user=user,
            raw=raw,
            commit=commit,
            default_environment=default_environment,
            default_connection_status=default_connection_status,
        )
    except WorkbookFormatError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if commit and not result["valid"]:
        raise HTTPException(status_code=422, detail={"message": "Workbook validation failed.", "errors": result["errors"]})
    return result
