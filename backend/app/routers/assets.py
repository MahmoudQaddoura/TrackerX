from __future__ import annotations

"""Project asset inventory and destination-port network matrix endpoints."""

from ipaddress import ip_address

import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import (
    check_project_access,
    get_current_user,
    require_project_access,
    require_project_content_editor,
)
from app.models import Asset, AssetConnection, AssetPort, Project, User
from app.models.asset import (
    ASSET_ENVIRONMENTS,
    ASSET_STATUSES,
    CONNECTION_STATUSES,
    PORT_PROTOCOLS,
)
from app.schemas.asset import (
    AssetConnectionInput,
    AssetConnectionOut,
    AssetInput,
    AssetMatrixOut,
    AssetOut,
    AssetPortInput,
    AssetPortOut,
    AssetUpdate,
)
from app.services.asset_inventory_excel import build_asset_inventory_excel
from app.services.asset_inventory_pdf import build_asset_inventory_pdf

router = APIRouter(tags=["asset-inventory"])


def _assert_staff(user: User) -> None:
    if user.role == "client":
        raise HTTPException(
            status_code=403,
            detail="Infrastructure inventory is available only to authorized project staff.",
        )


def _project_for_write(db: Session, user: User, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    _assert_staff(user)
    return project


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _validate_asset(data: dict, existing: Asset | None = None) -> dict:
    normalized = dict(data)
    for field in (
        "hostname",
        "ip_address",
        "purpose",
        "tier",
        "os",
        "cpu",
        "ram",
        "storage",
        "applications",
        "database",
        "services",
        "notes",
    ):
        if field in normalized:
            normalized[field] = _clean_text(normalized[field])

    hostname = normalized.get("hostname", existing.hostname if existing else None)
    address = normalized.get("ip_address", existing.ip_address if existing else None)
    environment = normalized.get("environment", existing.environment if existing else None)
    status = normalized.get("status", existing.status if existing else None)
    if not hostname:
        raise HTTPException(status_code=422, detail="Hostname is required.")
    if not address:
        raise HTTPException(status_code=422, detail="IP address is required.")
    try:
        ip_address(address)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Enter a valid IPv4 or IPv6 address.") from exc
    if environment not in ASSET_ENVIRONMENTS:
        raise HTTPException(status_code=422, detail="Invalid asset environment.")
    if status not in ASSET_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid asset status.")
    normalized["hostname"] = hostname
    normalized["ip_address"] = address
    normalized["environment"] = environment
    normalized["status"] = status
    return normalized


def _validate_port(data: dict) -> dict:
    normalized = dict(data)
    normalized["protocol"] = str(normalized.get("protocol", "tcp")).strip().lower()
    normalized["service"] = str(normalized.get("service", "")).strip()
    normalized["notes"] = _clean_text(normalized.get("notes"))
    if normalized["protocol"] not in PORT_PROTOCOLS:
        raise HTTPException(status_code=422, detail="Protocol must be TCP or UDP.")
    if not normalized["service"]:
        raise HTTPException(status_code=422, detail="Service name is required.")
    return normalized


def _asset_out(asset: Asset) -> dict:
    return {
        "id": asset.id,
        "project_id": asset.project_id,
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
        "ports": [_port_out(port) for port in asset.ports],
        "created_by_name": asset.created_by.full_name if asset.created_by else None,
        "created_at": asset.created_at,
        "updated_at": asset.updated_at,
    }


def _port_out(port: AssetPort) -> dict:
    return {
        "id": port.id,
        "asset_id": port.asset_id,
        "port": port.port,
        "protocol": port.protocol,
        "service": port.service,
        "notes": port.notes,
        "created_at": port.created_at,
        "updated_at": port.updated_at,
    }


def _connection_out(connection: AssetConnection) -> dict:
    return {
        "id": connection.id,
        "source_asset_id": connection.source_asset_id,
        "port_id": connection.port_id,
        "status": connection.status,
        "updated_at": connection.updated_at,
    }


def _commit_or_conflict(db: Session, message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=message) from exc


def _inventory_export_data(
    db: Session,
    project_id: int,
) -> tuple[list[Asset], list[dict]]:
    """Load one consistent, ordered dataset for every inventory export format."""

    assets = (
        db.query(Asset)
        .options(selectinload(Asset.ports), selectinload(Asset.created_by))
        .filter(Asset.project_id == project_id)
        .order_by(Asset.environment, Asset.hostname)
        .all()
    )
    if not assets:
        raise HTTPException(
            status_code=422,
            detail="Add at least one asset before exporting the inventory.",
        )

    asset_ids = [asset.id for asset in assets]
    port_ids = [port.id for asset in assets for port in asset.ports]
    connections = (
        db.query(AssetConnection)
        .options(
            selectinload(AssetConnection.source_asset),
            selectinload(AssetConnection.port_record).selectinload(AssetPort.asset),
        )
        .filter(
            AssetConnection.source_asset_id.in_(asset_ids),
            AssetConnection.port_id.in_(port_ids),
        )
        .all()
        if port_ids
        else []
    )
    connections.sort(
        key=lambda connection: (
            connection.source_asset.hostname,
            connection.port_record.asset.hostname,
            connection.port_record.port,
            connection.port_record.protocol,
        )
    )
    connection_rows = [
        {
            "id": connection.id,
            "source_asset_id": connection.source_asset_id,
            "source_hostname": connection.source_asset.hostname,
            "source_ip_address": connection.source_asset.ip_address,
            "destination_asset_id": connection.port_record.asset_id,
            "destination_hostname": connection.port_record.asset.hostname,
            "destination_ip_address": connection.port_record.asset.ip_address,
            "port_id": connection.port_id,
            "port": connection.port_record.port,
            "protocol": connection.port_record.protocol,
            "service": connection.port_record.service,
            "status": connection.status,
            "updated_at": connection.updated_at,
        }
        for connection in connections
    ]
    return assets, connection_rows


def _inventory_filename(project: Project, extension: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", project.name.lower()).strip("-")
    return f"trackerx-{slug or f'project-{project.id}'}-asset-inventory.{extension}"


@router.get("/projects/{project_id}/assets", response_model=list[AssetOut])
def list_assets(
    project: Project = Depends(require_project_access),
    db: Session = Depends(get_db),
    environment: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=150),
):
    if environment is not None and environment not in ASSET_ENVIRONMENTS:
        raise HTTPException(status_code=422, detail="Invalid asset environment.")
    query = (
        db.query(Asset)
        .options(selectinload(Asset.ports), selectinload(Asset.created_by))
        .filter(Asset.project_id == project.id)
    )
    if environment:
        query = query.filter(Asset.environment == environment)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Asset.hostname.ilike(pattern),
                Asset.ip_address.ilike(pattern),
                Asset.purpose.ilike(pattern),
                Asset.tier.ilike(pattern),
                Asset.applications.ilike(pattern),
                Asset.services.ilike(pattern),
            )
        )
    rows = query.order_by(Asset.environment, Asset.hostname).all()
    return [_asset_out(asset) for asset in rows]


@router.get("/projects/{project_id}/assets/export/pdf")
def export_asset_inventory_pdf(
    project: Project = Depends(require_project_access),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assets, connection_rows = _inventory_export_data(db, project.id)
    pdf = build_asset_inventory_pdf(
        project_name=project.name,
        project_type=project.project_type,
        assets=[_asset_out(asset) for asset in assets],
        connections=connection_rows,
        prepared_by=user.full_name,
    )
    filename = _inventory_filename(project, "pdf")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/assets/export/excel")
def export_asset_inventory_excel(
    project: Project = Depends(require_project_access),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assets, connection_rows = _inventory_export_data(db, project.id)
    workbook = build_asset_inventory_excel(
        project_id=project.id,
        project_name=project.name,
        project_type=project.project_type,
        assets=[_asset_out(asset) for asset in assets],
        connections=connection_rows,
        exported_by=user.full_name,
    )
    filename = _inventory_filename(project, "xlsx")
    return Response(
        content=workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/projects/{project_id}/assets", response_model=AssetOut, status_code=201)
def create_asset(
    project_id: int,
    inp: AssetInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    _project_for_write(db, user, project_id)
    asset = Asset(
        project_id=project_id,
        created_by_id=user.id,
        **_validate_asset(inp.model_dump()),
    )
    db.add(asset)
    _commit_or_conflict(db, "That hostname or IP address already exists in this project.")
    db.refresh(asset)
    return _asset_out(asset)


@router.put("/assets/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: int,
    inp: AssetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    _project_for_write(db, user, asset.project_id)
    data = _validate_asset(inp.model_dump(exclude_unset=True), asset)
    environment_changed = data.get("environment") != asset.environment
    for field, value in data.items():
        setattr(asset, field, value)
    if environment_changed:
        asset.source_connections.clear()
        for port in asset.ports:
            port.connections.clear()
    _commit_or_conflict(db, "That hostname or IP address already exists in this project.")
    db.refresh(asset)
    return _asset_out(asset)


@router.delete("/assets/{asset_id}", status_code=204)
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    _project_for_write(db, user, asset.project_id)
    db.delete(asset)
    db.commit()


@router.post("/assets/{asset_id}/ports", response_model=AssetPortOut, status_code=201)
def create_asset_port(
    asset_id: int,
    inp: AssetPortInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    _project_for_write(db, user, asset.project_id)
    port = AssetPort(asset_id=asset_id, **_validate_port(inp.model_dump()))
    db.add(port)
    _commit_or_conflict(db, "That port and protocol already exist for this IP address.")
    db.refresh(port)
    return _port_out(port)


@router.delete("/asset-ports/{port_id}", status_code=204)
def delete_asset_port(
    port_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    port = db.get(AssetPort, port_id)
    if port is None:
        raise HTTPException(status_code=404, detail="Asset port not found.")
    _project_for_write(db, user, port.asset.project_id)
    db.delete(port)
    db.commit()


@router.get("/projects/{project_id}/asset-matrix", response_model=AssetMatrixOut)
def get_asset_matrix(
    project: Project = Depends(require_project_access),
    db: Session = Depends(get_db),
    environment: str = Query(default="production"),
):
    if environment not in ASSET_ENVIRONMENTS:
        raise HTTPException(status_code=422, detail="Invalid asset environment.")
    assets = (
        db.query(Asset)
        .options(selectinload(Asset.ports), selectinload(Asset.created_by))
        .filter(Asset.project_id == project.id, Asset.environment == environment)
        .order_by(Asset.hostname)
        .all()
    )
    asset_ids = [asset.id for asset in assets]
    port_ids = [port.id for asset in assets for port in asset.ports]
    if not asset_ids or not port_ids:
        connections = []
    else:
        connections = (
            db.query(AssetConnection)
            .filter(
                AssetConnection.source_asset_id.in_(asset_ids),
                AssetConnection.port_id.in_(port_ids),
            )
            .all()
        )
    return {
        "environment": environment,
        "assets": [_asset_out(asset) for asset in assets],
        "connections": [_connection_out(connection) for connection in connections],
    }


@router.put(
    "/asset-ports/{port_id}/connections/{source_asset_id}",
    response_model=AssetConnectionOut,
)
def set_asset_connection(
    port_id: int,
    source_asset_id: int,
    inp: AssetConnectionInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    status = inp.status.strip().lower()
    if status not in CONNECTION_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid connection status.")
    port = db.get(AssetPort, port_id)
    source = db.get(Asset, source_asset_id)
    if port is None or source is None:
        raise HTTPException(status_code=404, detail="Source asset or destination port not found.")
    destination = port.asset
    _project_for_write(db, user, destination.project_id)
    if source.project_id != destination.project_id:
        raise HTTPException(status_code=422, detail="Network rules cannot cross projects.")
    if source.environment != destination.environment:
        raise HTTPException(status_code=422, detail="Network rules cannot cross environments.")
    if source.id == destination.id:
        raise HTTPException(status_code=422, detail="A server does not need a rule to its own port.")
    connection = (
        db.query(AssetConnection)
        .filter(
            AssetConnection.source_asset_id == source_asset_id,
            AssetConnection.port_id == port_id,
        )
        .first()
    )
    if connection is None:
        connection = AssetConnection(
            source_asset_id=source_asset_id,
            port_id=port_id,
            status=status,
            updated_by_id=user.id,
        )
        db.add(connection)
    else:
        connection.status = status
        connection.updated_by_id = user.id
    db.commit()
    db.refresh(connection)
    return _connection_out(connection)
