from __future__ import annotations

"""Validated, non-destructive Excel import for the project asset inventory."""

from ipaddress import ip_address
from typing import Any

from sqlalchemy.orm import Session

from app.models import Asset, AssetConnection, AssetPort, Project, User
from app.models.asset import ASSET_ENVIRONMENTS, ASSET_STATUSES, CONNECTION_STATUSES, PORT_PROTOCOLS
from app.services.excel_inference import prepare_flexible_asset_workbook, trackerx_metadata
from app.services.ooxml_workbook import WorkbookCell, read_xlsx, table_rows


def _issue(sheet: str, row: int, field: str, message: str) -> dict[str, Any]:
    return {"sheet": sheet, "row": row, "field": field, "message": message}


def _value(
    cells: dict[str, WorkbookCell], field: str, sheet: str, row: int, issues: list[dict[str, Any]]
) -> Any:
    cell = cells.get(field, WorkbookCell(None))
    if cell.formula:
        issues.append(_issue(sheet, row, field, "Formula cells are not accepted for imports."))
        return None
    value = cell.value.strip() if isinstance(cell.value, str) else cell.value
    if isinstance(value, str) and len(value) > 20_000:
        issues.append(_issue(sheet, row, field, "Value exceeds 20,000 characters."))
        return None
    return value or None


def _integer(
    value: Any, sheet: str, row: int, field: str, issues: list[dict[str, Any]], *, minimum: int | None = None, maximum: int | None = None
) -> int | None:
    if value in {None, ""}:
        return None
    try:
        number = float(value)
        if not number.is_integer():
            raise ValueError
        parsed = int(number)
        if minimum is not None and parsed < minimum or maximum is not None and parsed > maximum:
            raise ValueError
        return parsed
    except (TypeError, ValueError):
        limits = f" from {minimum} to {maximum}" if minimum is not None and maximum is not None else ""
        issues.append(_issue(sheet, row, field, f"Enter a whole number{limits}."))
        return None


def _choice(value: Any, *, default: str, choices: tuple[str, ...]) -> str:
    normalized = str(value or default).strip().casefold().replace("&", "and").replace("-", "_").replace(" ", "_")
    aliases = {
        "disaster_recovery": "disaster_recovery",
        "not_needed": "not_needed",
        "not_required": "not_needed",
    }
    return aliases.get(normalized, normalized)


def _asset_ref(
    *,
    asset_id: int | None,
    hostname: Any,
    address: Any,
    by_id: dict[int, dict[str, Any]],
    by_hostname: dict[str, list[dict[str, Any]]],
    by_ip: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    if asset_id is not None:
        return [by_id[asset_id]] if asset_id in by_id else []
    candidates: dict[int, dict[str, Any]] = {}
    for item in by_hostname.get(str(hostname or "").strip().casefold(), []):
        candidates[id(item)] = item
    for item in by_ip.get(str(address or "").strip().casefold(), []):
        candidates[id(item)] = item
    return list(candidates.values())


def _empty_counts() -> dict[str, int]:
    return {
        "assets_create": 0,
        "assets_update": 0,
        "ports_create": 0,
        "ports_update": 0,
        "connections_create": 0,
        "connections_update": 0,
        "unchanged": 0,
    }


def import_asset_excel(
    db: Session,
    *,
    project: Project,
    user: User,
    raw: bytes,
    commit: bool,
    default_environment: str = "other",
    default_connection_status: str = "connected",
) -> dict[str, Any]:
    workbook = read_xlsx(raw)
    native = {"Assets", "Ports", "Connection Log"}.issubset(workbook)
    inferred_warnings: list[str] = []
    inferred_issues: list[dict[str, Any]] = []
    source_rows: int | None = None
    if native:
        metadata = trackerx_metadata("assets", workbook)
    else:
        workbook, metadata, inferred_warnings, inferred_issues, source_rows = prepare_flexible_asset_workbook(
            db,
            project=project,
            workbook=workbook,
            default_environment=default_environment,
            default_connection_status=default_connection_status,
        )
        if not workbook:
            return {
                "workspace": "assets", "valid": False, "committed": False,
                "rows_read": source_rows or 0, "counts": _empty_counts(),
                "warnings": inferred_warnings, "errors": inferred_issues[:200], **metadata,
            }
    asset_rows = table_rows(
        workbook,
        "Assets",
        required_headers={"Asset ID", "Hostname", "IP Address", "Environment", "Status"},
    )
    port_rows = table_rows(
        workbook,
        "Ports",
        required_headers={"Port ID", "Asset ID", "Hostname", "IP Address", "Port", "Protocol", "Service"},
    )
    connection_rows = table_rows(
        workbook,
        "Connection Log",
        required_headers={
            "Connection ID", "Source Asset ID", "Source Hostname", "Destination Asset ID",
            "Destination Hostname", "Port ID", "Port", "Protocol", "Status",
        },
    )
    issues: list[dict[str, Any]] = list(inferred_issues)
    warnings: list[str] = list(inferred_warnings)
    counts = _empty_counts()

    existing_assets = {
        item.id: item for item in db.query(Asset).filter(Asset.project_id == project.id).all()
    }
    existing_by_hostname = {item.hostname.strip().casefold(): item for item in existing_assets.values()}
    existing_by_ip = {item.ip_address.strip().casefold(): item for item in existing_assets.values()}
    seen_asset_ids: set[int] = set()
    seen_hostnames: set[str] = set()
    seen_ips: set[str] = set()
    asset_plans: list[dict[str, Any]] = []
    planned_by_id: dict[int, dict[str, Any]] = {}
    planned_by_hostname: dict[str, list[dict[str, Any]]] = {}
    planned_by_ip: dict[str, list[dict[str, Any]]] = {}

    for row_number, cells in asset_rows:
        sheet = "Assets"
        asset_id = _integer(_value(cells, "Asset ID", sheet, row_number, issues), sheet, row_number, "Asset ID", issues)
        hostname = _value(cells, "Hostname", sheet, row_number, issues)
        address = _value(cells, "IP Address", sheet, row_number, issues)
        environment = _choice(_value(cells, "Environment", sheet, row_number, issues), default="production", choices=ASSET_ENVIRONMENTS)
        status = _choice(_value(cells, "Status", sheet, row_number, issues), default="active", choices=ASSET_STATUSES)
        if not hostname:
            issues.append(_issue(sheet, row_number, "Hostname", "Hostname is required."))
            continue
        if not address:
            issues.append(_issue(sheet, row_number, "IP Address", "IP address is required."))
            continue
        try:
            ip_address(str(address))
        except ValueError:
            issues.append(_issue(sheet, row_number, "IP Address", "Enter a valid IPv4 or IPv6 address."))
        if environment not in ASSET_ENVIRONMENTS:
            issues.append(_issue(sheet, row_number, "Environment", f"Use one of: {', '.join(ASSET_ENVIRONMENTS)}."))
        if status not in ASSET_STATUSES:
            issues.append(_issue(sheet, row_number, "Status", f"Use one of: {', '.join(ASSET_STATUSES)}."))
        hostname_key = str(hostname).strip().casefold()
        ip_key = str(address).strip().casefold()
        if hostname_key in seen_hostnames:
            issues.append(_issue(sheet, row_number, "Hostname", "Hostname is duplicated in this workbook."))
        if ip_key in seen_ips:
            issues.append(_issue(sheet, row_number, "IP Address", "IP address is duplicated in this workbook."))
        seen_hostnames.add(hostname_key)
        seen_ips.add(ip_key)

        existing = None
        if asset_id is not None:
            if asset_id in seen_asset_ids:
                issues.append(_issue(sheet, row_number, "Asset ID", "Asset ID is duplicated in this workbook."))
            seen_asset_ids.add(asset_id)
            existing = existing_assets.get(asset_id)
            if existing is None:
                issues.append(_issue(sheet, row_number, "Asset ID", "Asset ID does not belong to this project."))
        else:
            matches = {item.id: item for item in (existing_by_hostname.get(hostname_key), existing_by_ip.get(ip_key)) if item}
            if len(matches) == 1:
                existing = next(iter(matches.values()))
                warnings.append(f"Assets row {row_number} matched existing asset '{hostname}' by hostname or IP.")
            elif len(matches) > 1:
                issues.append(_issue(sheet, row_number, "Asset ID", "Hostname and IP match different assets. Keep the correct Asset ID."))
        for key, matched in (("Hostname", existing_by_hostname.get(hostname_key)), ("IP Address", existing_by_ip.get(ip_key))):
            if matched is not None and (existing is None or matched.id != existing.id):
                issues.append(_issue(sheet, row_number, key, f"{key} already belongs to another asset in this project."))

        plan = {
            "row": row_number,
            "existing": existing,
            "hostname": str(hostname),
            "ip_address": str(address),
            "environment": environment,
            "purpose": _value(cells, "Purpose", sheet, row_number, issues),
            "tier": _value(cells, "Tier", sheet, row_number, issues),
            "os": _value(cells, "Operating System", sheet, row_number, issues),
            "cpu": _value(cells, "CPU", sheet, row_number, issues),
            "ram": _value(cells, "RAM", sheet, row_number, issues),
            "storage": _value(cells, "Storage", sheet, row_number, issues),
            "applications": _value(cells, "Applications", sheet, row_number, issues),
            "database": _value(cells, "Database", sheet, row_number, issues),
            "services": _value(cells, "Services", sheet, row_number, issues),
            "status": status,
            "notes": _value(cells, "Notes", sheet, row_number, issues),
        }
        asset_plans.append(plan)
        if asset_id is not None:
            planned_by_id[asset_id] = plan
        planned_by_hostname.setdefault(hostname_key, []).append(plan)
        planned_by_ip.setdefault(ip_key, []).append(plan)
        counts["assets_update" if existing else "assets_create"] += 1

    existing_ports = {
        port.id: port
        for port in db.query(AssetPort).join(Asset).filter(Asset.project_id == project.id).all()
    }
    existing_port_key = {(port.asset_id, port.port, port.protocol): port for port in existing_ports.values()}
    seen_port_ids: set[int] = set()
    seen_port_keys: set[tuple[int, int, str] | tuple[int, int, int, str]] = set()
    port_plans: list[dict[str, Any]] = []
    planned_port_by_id: dict[int, dict[str, Any]] = {}
    planned_port_key: dict[tuple[int, int, str], dict[str, Any]] = {}

    for row_number, cells in port_rows:
        sheet = "Ports"
        port_id = _integer(_value(cells, "Port ID", sheet, row_number, issues), sheet, row_number, "Port ID", issues)
        asset_id = _integer(_value(cells, "Asset ID", sheet, row_number, issues), sheet, row_number, "Asset ID", issues)
        hostname = _value(cells, "Hostname", sheet, row_number, issues)
        address = _value(cells, "IP Address", sheet, row_number, issues)
        port_number = _integer(_value(cells, "Port", sheet, row_number, issues), sheet, row_number, "Port", issues, minimum=1, maximum=65535)
        protocol = _choice(_value(cells, "Protocol", sheet, row_number, issues), default="tcp", choices=PORT_PROTOCOLS)
        service = _value(cells, "Service", sheet, row_number, issues)
        candidates = _asset_ref(asset_id=asset_id, hostname=hostname, address=address, by_id=planned_by_id, by_hostname=planned_by_hostname, by_ip=planned_by_ip)
        asset_plan = candidates[0] if len(candidates) == 1 else None
        if asset_plan is None:
            issues.append(_issue(sheet, row_number, "Asset ID", "Identify exactly one asset from the Assets sheet."))
        if protocol not in PORT_PROTOCOLS:
            issues.append(_issue(sheet, row_number, "Protocol", "Protocol must be TCP or UDP."))
        if not service:
            issues.append(_issue(sheet, row_number, "Service", "Service name is required."))
        existing = None
        if port_id is not None:
            if port_id in seen_port_ids:
                issues.append(_issue(sheet, row_number, "Port ID", "Port ID is duplicated in this workbook."))
            seen_port_ids.add(port_id)
            existing = existing_ports.get(port_id)
            if existing is None:
                issues.append(_issue(sheet, row_number, "Port ID", "Port ID does not belong to this project."))
            elif not asset_plan or not asset_plan["existing"] or existing.asset_id != asset_plan["existing"].id:
                issues.append(_issue(sheet, row_number, "Asset ID", "Port ID belongs to a different asset."))
        elif asset_plan and asset_plan["existing"] and port_number is not None:
            existing = existing_port_key.get((asset_plan["existing"].id, port_number, protocol))
            if existing:
                warnings.append(f"Ports row {row_number} matched an existing port by asset, port, and protocol.")
        plan = {
            "row": row_number, "existing": existing, "asset": asset_plan,
            "port": port_number, "protocol": protocol, "service": str(service or ""),
            "notes": _value(cells, "Notes", sheet, row_number, issues),
        }
        port_plans.append(plan)
        if port_id is not None:
            planned_port_by_id[port_id] = plan
        if asset_plan is not None and port_number is not None:
            if asset_plan["existing"]:
                conflicting_port = existing_port_key.get(
                    (asset_plan["existing"].id, port_number, protocol)
                )
                if conflicting_port and (existing is None or conflicting_port.id != existing.id):
                    issues.append(
                        _issue(
                            sheet,
                            row_number,
                            "Port",
                            "That port and protocol already belong to this asset.",
                        )
                    )
            identity = (id(asset_plan), port_number, protocol)
            if identity in seen_port_keys:
                issues.append(_issue(sheet, row_number, "Port", "Asset port and protocol are duplicated in this workbook."))
            seen_port_keys.add(identity)
            if asset_plan["existing"]:
                planned_port_key[(asset_plan["existing"].id, port_number, protocol)] = plan
        counts["ports_update" if existing else "ports_create"] += 1

    existing_connections = {
        connection.id: connection
        for connection in db.query(AssetConnection)
        .join(Asset, AssetConnection.source_asset_id == Asset.id)
        .filter(Asset.project_id == project.id)
        .all()
    }
    future_environments = {
        asset_id: asset.environment for asset_id, asset in existing_assets.items()
    }
    changed_environment_rows: dict[int, int] = {}
    for plan in asset_plans:
        existing_asset = plan["existing"]
        if existing_asset and existing_asset.environment != plan["environment"]:
            future_environments[existing_asset.id] = plan["environment"]
            changed_environment_rows[existing_asset.id] = plan["row"]
    for connection in existing_connections.values():
        source_id = connection.source_asset_id
        destination_id = connection.port_record.asset_id
        if not ({source_id, destination_id} & changed_environment_rows.keys()):
            continue
        if future_environments[source_id] != future_environments[destination_id]:
            changed_id = source_id if source_id in changed_environment_rows else destination_id
            issues.append(
                _issue(
                    "Assets",
                    changed_environment_rows[changed_id],
                    "Environment",
                    "This change would leave an existing connection across environments. Move both connected assets together before importing.",
                )
            )
    existing_connection_key = {(item.source_asset_id, item.port_id): item for item in existing_connections.values()}
    seen_connection_ids: set[int] = set()
    seen_connection_keys: set[tuple[int, int]] = set()
    connection_plans: list[dict[str, Any]] = []
    for row_number, cells in connection_rows:
        sheet = "Connection Log"
        connection_id = _integer(_value(cells, "Connection ID", sheet, row_number, issues), sheet, row_number, "Connection ID", issues)
        source_id = _integer(_value(cells, "Source Asset ID", sheet, row_number, issues), sheet, row_number, "Source Asset ID", issues)
        source = _asset_ref(
            asset_id=source_id,
            hostname=_value(cells, "Source Hostname", sheet, row_number, issues),
            address=_value(cells, "Source IP", sheet, row_number, issues),
            by_id=planned_by_id, by_hostname=planned_by_hostname, by_ip=planned_by_ip,
        )
        destination_id = _integer(_value(cells, "Destination Asset ID", sheet, row_number, issues), sheet, row_number, "Destination Asset ID", issues)
        destination = _asset_ref(
            asset_id=destination_id,
            hostname=_value(cells, "Destination Hostname", sheet, row_number, issues),
            address=_value(cells, "Destination IP", sheet, row_number, issues),
            by_id=planned_by_id, by_hostname=planned_by_hostname, by_ip=planned_by_ip,
        )
        source_plan = source[0] if len(source) == 1 else None
        destination_plan = destination[0] if len(destination) == 1 else None
        if source_plan is None:
            issues.append(_issue(sheet, row_number, "Source Asset ID", "Identify exactly one source asset from the Assets sheet."))
        if destination_plan is None:
            issues.append(_issue(sheet, row_number, "Destination Asset ID", "Identify exactly one destination asset from the Assets sheet."))
        port_id = _integer(_value(cells, "Port ID", sheet, row_number, issues), sheet, row_number, "Port ID", issues)
        port_number = _integer(_value(cells, "Port", sheet, row_number, issues), sheet, row_number, "Port", issues, minimum=1, maximum=65535)
        protocol = _choice(_value(cells, "Protocol", sheet, row_number, issues), default="tcp", choices=PORT_PROTOCOLS)
        port_plan = planned_port_by_id.get(port_id) if port_id is not None else None
        if port_plan is None and destination_plan and destination_plan["existing"] and port_number is not None:
            port_plan = planned_port_key.get((destination_plan["existing"].id, port_number, protocol))
        if port_plan is None:
            matches = [item for item in port_plans if item["asset"] is destination_plan and item["port"] == port_number and item["protocol"] == protocol]
            port_plan = matches[0] if len(matches) == 1 else None
        if port_plan is None:
            issues.append(_issue(sheet, row_number, "Port ID", "Identify exactly one destination port from the Ports sheet."))
        status = _choice(_value(cells, "Status", sheet, row_number, issues), default="not_needed", choices=CONNECTION_STATUSES)
        if status not in CONNECTION_STATUSES:
            issues.append(_issue(sheet, row_number, "Status", f"Use one of: {', '.join(CONNECTION_STATUSES)}."))
        if source_plan and destination_plan:
            if source_plan is destination_plan:
                issues.append(_issue(sheet, row_number, "Destination Asset ID", "A server does not need a rule to its own port."))
            if source_plan["environment"] != destination_plan["environment"]:
                issues.append(_issue(sheet, row_number, "Destination Asset ID", "Network rules cannot cross environments."))
        existing = None
        if connection_id is not None:
            if connection_id in seen_connection_ids:
                issues.append(_issue(sheet, row_number, "Connection ID", "Connection ID is duplicated in this workbook."))
            seen_connection_ids.add(connection_id)
            existing = existing_connections.get(connection_id)
            if existing is None:
                issues.append(_issue(sheet, row_number, "Connection ID", "Connection ID does not belong to this project."))
            elif (
                not source_plan
                or not source_plan["existing"]
                or not port_plan
                or not port_plan["existing"]
                or existing.source_asset_id != source_plan["existing"].id
                or existing.port_id != port_plan["existing"].id
            ):
                issues.append(
                    _issue(
                        sheet,
                        row_number,
                        "Connection ID",
                        "Connection ID belongs to a different source or destination port.",
                    )
                )
        elif source_plan and source_plan["existing"] and port_plan and port_plan["existing"]:
            existing = existing_connection_key.get((source_plan["existing"].id, port_plan["existing"].id))
        identity = (id(source_plan), id(port_plan))
        if source_plan and port_plan:
            if identity in seen_connection_keys:
                issues.append(_issue(sheet, row_number, "Connection ID", "Source and destination port are duplicated in this workbook."))
            seen_connection_keys.add(identity)
        connection_plans.append({"existing": existing, "source": source_plan, "port": port_plan, "status": status})
        counts["connections_update" if existing else "connections_create"] += 1

    result: dict[str, Any] = {
        "workspace": "assets", "valid": not issues, "committed": False,
        "rows_read": source_rows if source_rows is not None else len(asset_rows) + len(port_rows) + len(connection_rows),
        "counts": counts, "warnings": warnings, "errors": issues[:200], **metadata,
    }
    if issues or not commit:
        return result

    for plan in asset_plans:
        asset = plan["existing"] or Asset(project_id=project.id, created_by_id=user.id)
        for field in (
            "hostname", "ip_address", "environment", "purpose", "tier", "os", "cpu", "ram",
            "storage", "applications", "database", "services", "status", "notes",
        ):
            setattr(asset, field, plan[field])
        if plan["existing"] is None:
            db.add(asset)
        db.flush()
        plan["record"] = asset

    for plan in port_plans:
        port = plan["existing"] or AssetPort()
        port.asset_id = plan["asset"]["record"].id
        port.port = plan["port"]
        port.protocol = plan["protocol"]
        port.service = plan["service"]
        port.notes = plan["notes"]
        if plan["existing"] is None:
            db.add(port)
        db.flush()
        plan["record"] = port

    for plan in connection_plans:
        connection = plan["existing"] or AssetConnection()
        connection.source_asset_id = plan["source"]["record"].id
        connection.port_id = plan["port"]["record"].id
        connection.status = plan["status"]
        connection.updated_by_id = user.id
        if plan["existing"] is None:
            db.add(connection)
    db.commit()
    result["committed"] = True
    return result
