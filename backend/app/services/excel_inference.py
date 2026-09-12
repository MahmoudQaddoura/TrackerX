from __future__ import annotations

"""Deterministic schema inference for external Excel workbooks.

This module deliberately does not use an LLM.  It recognizes well-known column
meanings, presents the mapping in preview, and converts external tables into the
same canonical workbook shape used by TrackerX exports.  The existing importers
therefore remain the single validation and transaction boundary.
"""

from collections import defaultdict
from dataclasses import dataclass
from ipaddress import ip_address
import re
import unicodedata
from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.models import Asset, AssetConnection, AssetPort, Project, TeamMember, User
from app.models.asset import ASSET_ENVIRONMENTS, ASSET_STATUSES, CONNECTION_STATUSES
from app.models.task import TASK_STATUSES
from app.services.ooxml_workbook import WorkbookCell, WorkbookRow, column_name


ASSET_HEADERS = (
    "Asset ID", "Hostname", "IP Address", "Environment", "Purpose", "Tier",
    "Operating System", "CPU", "RAM", "Storage", "Applications", "Database",
    "Services", "Status", "Notes",
)
PORT_HEADERS = (
    "Port ID", "Asset ID", "Hostname", "IP Address", "Port", "Protocol", "Service", "Notes",
)
CONNECTION_HEADERS = (
    "Connection ID", "Source Asset ID", "Source Hostname", "Source IP",
    "Destination Asset ID", "Destination Hostname", "Destination IP", "Port ID",
    "Port", "Protocol", "Service", "Status",
)
MILESTONE_HEADERS = (
    "Milestone ID", "Title", "Description", "Start Date", "End Date", "Sort Order",
)
TASK_HEADERS = (
    "Task ID", "Milestone ID", "Milestone Title", "Title", "Description", "Status",
    "Assignee Employee IDs", "Start Date", "End Date", "Estimated Days", "Is Delayed",
    "Delay Cause", "Delay Comment", "Sort Order",
)


def _normalized(value: object | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).casefold()
    return " ".join(re.findall(r"[a-z0-9]+", text))


def _aliases(*values: str) -> set[str]:
    return {_normalized(value) for value in values}


SCHEMAS: dict[str, dict[str, set[str]]] = {
    "network": {
        "source_name": _aliases("source", "source name", "source role", "source asset", "from", "origin"),
        "source_ip": _aliases("source ip", "source ip address", "src ip", "origin ip", "from ip"),
        "destination_name": _aliases("destination", "destination name", "destination role", "destination asset", "target", "to"),
        "destination_ip": _aliases("destination ip", "destination ip address", "dest ip", "dst ip", "target ip", "to ip"),
        "port": _aliases("port", "port number", "destination port", "dest port", "dst port"),
        "protocol": _aliases("protocol", "transport", "transport protocol"),
        "service": _aliases("service", "service name", "application service", "application"),
        "environment": _aliases("environment", "env", "stage"),
        "status": _aliases("status", "connection status", "state"),
        "notes": _aliases("notes", "note", "description", "remarks", "comments", "what is copied notes", "what is copied"),
    },
    "asset": {
        "asset_id": _aliases("asset id", "trackerx asset id"),
        "hostname": _aliases("hostname", "host name", "server name", "device name", "asset", "asset name", "node", "name"),
        "ip_address": _aliases("ip", "ip address", "address", "host ip", "server ip"),
        "environment": _aliases("environment", "env", "stage"),
        "purpose": _aliases("purpose", "role", "function", "asset role", "server role"),
        "tier": _aliases("tier", "layer"),
        "os": _aliases("operating system", "os", "platform"),
        "cpu": _aliases("cpu", "vcpu", "processor"),
        "ram": _aliases("ram", "memory"),
        "storage": _aliases("storage", "disk", "disk size"),
        "applications": _aliases("applications", "application", "apps"),
        "database": _aliases("database", "db"),
        "services": _aliases("services", "service"),
        "status": _aliases("status", "asset status", "state"),
        "notes": _aliases("notes", "note", "description", "remarks", "comments"),
        "port": _aliases("port", "port number", "listening port"),
        "protocol": _aliases("protocol", "transport"),
        "port_service": _aliases("port service", "service name"),
    },
    "task": {
        "task_id": _aliases("task id", "trackerx task id"),
        "milestone_id": _aliases("milestone id", "phase id", "trackerx milestone id"),
        "milestone_title": _aliases("milestone", "milestone title", "phase", "phase name", "stage", "sprint", "epic", "workstream"),
        "title": _aliases("task", "task title", "title", "action", "activity", "work item", "item", "deliverable"),
        "description": _aliases("description", "task description", "details", "scope", "notes"),
        "status": _aliases("status", "task status", "state", "progress status"),
        "assignees": _aliases("assignee", "assignees", "assigned to", "owner", "responsible", "resource", "employee", "employee id"),
        "start_date": _aliases("start", "start date", "planned start", "begin date"),
        "end_date": _aliases("end", "end date", "due", "due date", "deadline", "planned end", "finish date"),
        "estimated_days": _aliases("estimated days", "estimate days", "est days", "duration", "duration days", "effort days"),
        "is_delayed": _aliases("is delayed", "delayed", "delay"),
        "delay_cause": _aliases("delay cause", "delay owner", "delay reason type"),
        "delay_comment": _aliases("delay comment", "delay reason", "delay notes"),
        "sort_order": _aliases("sort order", "order", "sequence", "priority order"),
    },
    "milestone": {
        "milestone_id": _aliases("milestone id", "phase id", "trackerx milestone id"),
        "title": _aliases("milestone", "milestone title", "phase", "phase name", "stage", "stage name", "title"),
        "description": _aliases("description", "milestone description", "scope", "notes"),
        "start_date": _aliases("start", "start date", "planned start", "begin date"),
        "end_date": _aliases("end", "end date", "due", "due date", "deadline", "planned end", "finish date"),
        "sort_order": _aliases("sort order", "order", "sequence"),
    },
}

TARGET_LABELS = {
    "source_name": "Source asset name", "source_ip": "Source asset IP",
    "destination_name": "Destination asset name", "destination_ip": "Destination asset IP",
    "port": "Destination port", "protocol": "Protocol", "service": "Service",
    "environment": "Environment", "status": "Status", "notes": "Notes",
    "asset_id": "Asset ID", "hostname": "Hostname", "ip_address": "IP address",
    "purpose": "Purpose", "tier": "Tier", "os": "Operating system", "cpu": "CPU",
    "ram": "RAM", "storage": "Storage", "applications": "Applications",
    "database": "Database", "services": "Services", "port_service": "Port service",
    "task_id": "Task ID", "milestone_id": "Milestone ID", "milestone_title": "Milestone",
    "title": "Title", "description": "Description", "assignees": "Assignees",
    "start_date": "Start date", "end_date": "End date", "estimated_days": "Estimated days",
    "is_delayed": "Delayed", "delay_cause": "Delay cause", "delay_comment": "Delay comment",
    "sort_order": "Sort order",
}


@dataclass(frozen=True)
class DetectedTable:
    sheet: str
    kind: str
    header_row: int
    columns: dict[str, tuple[str, str]]  # target -> (worksheet column, visible source header)
    confidence: int
    rows: tuple[WorkbookRow, ...]

    def records(self) -> list[tuple[int, dict[str, WorkbookCell]]]:
        output: list[tuple[int, dict[str, WorkbookCell]]] = []
        for row in self.rows:
            if row.number <= self.header_row:
                continue
            mapped = {
                target: row.values.get(column, WorkbookCell(None))
                for target, (column, _label) in self.columns.items()
            }
            if any(cell.value not in {None, ""} for cell in mapped.values()):
                output.append((row.number, mapped))
        return output

    def public(self) -> dict[str, Any]:
        return {
            "sheet": self.sheet,
            "kind": self.kind,
            "header_row": self.header_row,
            "confidence": self.confidence,
            "rows": len(self.records()),
            "mapping": [
                {"source": label, "target": TARGET_LABELS.get(target, target.replace("_", " ").title())}
                for target, (_column, label) in self.columns.items()
            ],
        }


def _mapped_columns(row: WorkbookRow, schema: dict[str, set[str]]) -> dict[str, tuple[str, str]]:
    output: dict[str, tuple[str, str]] = {}
    used_columns: set[str] = set()
    for target, aliases in schema.items():
        best: tuple[int, str, str] | None = None
        for column, cell in row.values.items():
            label = str(cell.value or "").strip()
            normalized_label = _normalized(label)
            if column in used_columns or not normalized_label:
                continue
            score = 0
            for alias in aliases:
                if normalized_label == alias:
                    score = max(score, 100)
                    continue
                alias_words = set(alias.split())
                label_words = set(normalized_label.split())
                if len(alias_words) >= 2 and alias_words.issubset(label_words):
                    score = max(score, 60 + len(alias_words))
                elif len(label_words) >= 2 and label_words.issubset(alias_words):
                    score = max(score, 50 + len(label_words))
            if score and (best is None or score > best[0]):
                best = (score, column, label)
        if best is not None:
            output[target] = (best[1], best[2])
            used_columns.add(best[1])
    return output


def _candidate_score(kind: str, fields: set[str], sheet_name: str, headers: Iterable[str]) -> int:
    header_words = {_normalized(value) for value in headers}
    sheet = _normalized(sheet_name)
    if kind == "network":
        if not {"source_ip", "destination_ip", "port"}.issubset(fields):
            return -1
        score = 88 + min(10, 2 * len(fields - {"source_ip", "destination_ip", "port"}))
    elif kind == "asset":
        if "ip_address" not in fields or not ({"hostname", "purpose"} & fields):
            return -1
        score = 72 + min(20, 3 * len(fields - {"ip_address"}))
    elif kind == "task":
        task_hint = bool({"status", "milestone_title", "assignees", "estimated_days", "task_id"} & fields)
        task_named = "task" in sheet or bool(header_words & _aliases("task", "task title", "activity", "work item"))
        if "title" not in fields or not (task_hint or task_named):
            return -1
        score = 68 + min(24, 3 * len(fields - {"title"})) + (4 if task_named else 0)
    else:
        milestone_named = "milestone" in sheet or "phase" in sheet or bool(
            header_words & _aliases("milestone", "milestone title", "phase", "phase name")
        )
        if "title" not in fields or not milestone_named:
            return -1
        score = 70 + min(22, 4 * len(fields - {"title"}))
    return min(99, score)


def detect_tables(workbook: dict[str, list[WorkbookRow]]) -> list[DetectedTable]:
    """Locate the strongest supported table on every worksheet."""
    detected: list[DetectedTable] = []
    for sheet_name, rows in workbook.items():
        best: DetectedTable | None = None
        for row in rows[:30]:
            visible_headers = [str(cell.value or "").strip() for cell in row.values.values()]
            if sum(bool(value) for value in visible_headers) < 2:
                continue
            for kind, schema in SCHEMAS.items():
                mapped = _mapped_columns(row, schema)
                score = _candidate_score(kind, set(mapped), sheet_name, visible_headers)
                if score < 0:
                    continue
                candidate = DetectedTable(
                    sheet=sheet_name,
                    kind=kind,
                    header_row=row.number,
                    columns=mapped,
                    confidence=score,
                    rows=tuple(rows),
                )
                if best is None or candidate.confidence > best.confidence:
                    best = candidate
        if best is not None:
            detected.append(best)
    return detected


def _canonical_sheet(headers: tuple[str, ...], records: list[dict[str, Any]]) -> list[WorkbookRow]:
    header_values = {
        column_name(index): WorkbookCell(header)
        for index, header in enumerate(headers, start=1)
    }
    rows = [WorkbookRow(number=1, values=header_values)]
    for row_number, record in enumerate(records, start=2):
        rows.append(
            WorkbookRow(
                number=row_number,
                values={
                    column_name(index): WorkbookCell(record.get(header))
                    for index, header in enumerate(headers, start=1)
                },
            )
        )
    return rows


def _cell_value(
    cells: dict[str, WorkbookCell],
    field: str,
    *,
    sheet: str,
    row: int,
    issues: list[dict[str, Any]],
) -> Any:
    cell = cells.get(field, WorkbookCell(None))
    if cell.formula:
        issues.append({
            "sheet": sheet, "row": row, "field": TARGET_LABELS.get(field, field),
            "message": "Formula cells are not accepted for imported fields. Paste the calculated value first.",
        })
        return None
    value = cell.value.strip() if isinstance(cell.value, str) else cell.value
    if isinstance(value, str) and len(value) > 20_000:
        issues.append({
            "sheet": sheet, "row": row, "field": TARGET_LABELS.get(field, field),
            "message": "Value exceeds 20,000 characters.",
        })
        return None
    return value if value not in {None, ""} else None


def _metadata(tables: list[DetectedTable], workspace: str, detected_format: str) -> dict[str, Any]:
    return {
        "detected_format": detected_format,
        "suggested_workspace": workspace,
        "detected_tables": [table.public() for table in tables],
    }


def _clean_hostname(label: Any, address: str) -> str:
    text = str(label or "").strip()
    if text:
        text = re.sub(r"\s*\([^)]*\).*?$", "", text).strip()
        slug = re.sub(r"[^a-zA-Z0-9.-]+", "-", text).strip("-.").casefold()
        if slug:
            return slug[:120]
    return "asset-" + re.sub(r"[^a-zA-Z0-9]+", "-", address).strip("-").casefold()


def _normalized_choice(value: Any, choices: tuple[str, ...], aliases: dict[str, str]) -> str | None:
    if value in {None, ""}:
        return None
    normalized = _normalized(value).replace(" ", "_")
    selected = aliases.get(normalized, normalized)
    return selected if selected in choices else None


def _merge_text(existing: Any, additions: Iterable[Any]) -> str | None:
    parts: list[str] = []
    for value in (existing, *additions):
        text = str(value or "").strip()
        if text and text.casefold() not in {part.casefold() for part in parts}:
            parts.append(text)
    return "\n".join(parts) or None


def _split_protocols(value: Any) -> list[str]:
    if value in {None, ""}:
        return ["tcp"]
    parts = re.split(r"[,;/&+\s]+", str(value).casefold())
    protocols = [part for part in parts if part in {"tcp", "udp"}]
    return list(dict.fromkeys(protocols))


def _split_ports(value: Any) -> list[int]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = int(value)
        return [number] if float(value).is_integer() and 1 <= number <= 65535 else []
    ports: list[int] = []
    for token in re.findall(r"\d+", str(value or "")):
        number = int(token)
        if 1 <= number <= 65535 and number not in ports:
            ports.append(number)
    return ports


def _service_for(port: int, supplied: Any) -> str:
    if supplied not in {None, ""}:
        return str(supplied).strip()
    return {22: "SSH", 53: "DNS", 80: "HTTP", 111: "rpcbind", 443: "HTTPS", 2049: "NFS", 3306: "MySQL", 5432: "PostgreSQL"}.get(port, f"Port {port}")


def prepare_flexible_asset_workbook(
    db: Session,
    *,
    project: Project,
    workbook: dict[str, list[WorkbookRow]],
    default_environment: str,
    default_connection_status: str,
) -> tuple[dict[str, list[WorkbookRow]], dict[str, Any], list[str], list[dict[str, Any]], int]:
    tables = detect_tables(workbook)
    accepted = [table for table in tables if table.kind in {"network", "asset"}]
    warnings: list[str] = []
    issues: list[dict[str, Any]] = []
    source_rows = sum(len(table.records()) for table in accepted)
    if not accepted:
        suggested = "kanban" if any(table.kind in {"task", "milestone"} for table in tables) else "assets"
        message = (
            "This workbook contains Kanban work, not asset inventory data. Open Kanban and import it there."
            if suggested == "kanban"
            else "TrackerX could not find an asset or network table. Include IP/hostname columns, or source IP, destination IP, and port columns."
        )
        return {}, {**_metadata(tables, suggested, "unrecognized"), "manual_fields": []}, warnings, [
            {"sheet": "Workbook", "row": 0, "field": "Structure", "message": message}
        ], source_rows

    existing_assets = db.query(Asset).filter(Asset.project_id == project.id).all()
    existing_by_ip = {asset.ip_address.strip().casefold(): asset for asset in existing_assets}
    existing_by_hostname = {asset.hostname.strip().casefold(): asset for asset in existing_assets}
    existing_ports = (
        db.query(AssetPort).join(Asset).filter(Asset.project_id == project.id).all()
    )
    port_by_key = {(port.asset_id, port.port, port.protocol): port for port in existing_ports}
    existing_connections = (
        db.query(AssetConnection)
        .join(Asset, AssetConnection.source_asset_id == Asset.id)
        .filter(Asset.project_id == project.id)
        .all()
    )
    connection_by_key = {(item.source_asset_id, item.port_id): item for item in existing_connections}

    asset_plans: dict[str, dict[str, Any]] = {}
    planned_hostnames: dict[str, str] = {}

    def plan_asset(
        *, sheet: str, row: int, address_value: Any, label: Any, purpose: Any = None,
        notes: Any = None, supplied: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        address = str(address_value or "").strip()
        try:
            address = str(ip_address(address))
        except ValueError:
            issues.append({"sheet": sheet, "row": row, "field": "IP address", "message": "A valid IPv4 or IPv6 address is required."})
            return None
        key = address.casefold()
        plan = asset_plans.get(key)
        supplied = supplied or {}
        if plan is None:
            existing = existing_by_ip.get(key)
            proposed_hostname = existing.hostname if existing else _clean_hostname(label, address)
            hostname_key = proposed_hostname.casefold()
            conflict = existing_by_hostname.get(hostname_key)
            if not existing and (hostname_key in planned_hostnames or (conflict and conflict.ip_address.casefold() != key)):
                suffix = re.sub(r"[^a-zA-Z0-9]+", "-", address).strip("-")
                proposed_hostname = f"{proposed_hostname[:90]}-{suffix}"
                warnings.append(f"{sheet} row {row}: generated a unique hostname because '{label}' was already in use.")
            planned_hostnames[proposed_hostname.casefold()] = key
            environment = _normalized_choice(
                supplied.get("environment"), ASSET_ENVIRONMENTS,
                {"prod": "production", "dev": "development", "dr": "disaster_recovery", "uat": "test"},
            ) or (existing.environment if existing else default_environment)
            status = _normalized_choice(
                supplied.get("status"), ASSET_STATUSES,
                {"enabled": "active", "disabled": "inactive", "decommissioned": "retired"},
            ) or (existing.status if existing else "active")
            plan = {
                "existing": existing,
                "Asset ID": existing.id if existing else None,
                "Hostname": proposed_hostname,
                "IP Address": address,
                "Environment": environment,
                "Purpose": existing.purpose if existing else None,
                "Tier": existing.tier if existing else None,
                "Operating System": existing.os if existing else None,
                "CPU": existing.cpu if existing else None,
                "RAM": existing.ram if existing else None,
                "Storage": existing.storage if existing else None,
                "Applications": existing.applications if existing else None,
                "Database": existing.database if existing else None,
                "Services": existing.services if existing else None,
                "Status": status,
                "Notes": existing.notes if existing else None,
                "_labels": [], "_notes": [],
            }
            asset_plans[key] = plan
        if label and str(label).strip() not in plan["_labels"]:
            plan["_labels"].append(str(label).strip())
        if notes and str(notes).strip() not in plan["_notes"]:
            plan["_notes"].append(str(notes).strip())
        if purpose and not plan["Purpose"]:
            plan["Purpose"] = str(purpose).strip()
        field_map = {
            "purpose": "Purpose", "tier": "Tier", "os": "Operating System", "cpu": "CPU",
            "ram": "RAM", "storage": "Storage", "applications": "Applications",
            "database": "Database", "services": "Services",
        }
        for source, target in field_map.items():
            value = supplied.get(source)
            if value not in {None, ""} and not plan[target]:
                plan[target] = str(value).strip()
        return plan

    port_plans: dict[tuple[str, int, str], dict[str, Any]] = {}
    connection_plans: dict[tuple[str, str, int, str], dict[str, Any]] = {}
    graph: dict[str, set[str]] = defaultdict(set)
    has_environment = False
    has_connection_status = False

    for table in accepted:
        for row_number, cells in table.records():
            values = {
                field: _cell_value(cells, field, sheet=table.sheet, row=row_number, issues=issues)
                for field in table.columns
            }
            if table.kind == "asset":
                has_environment = has_environment or values.get("environment") not in {None, ""}
                plan = plan_asset(
                    sheet=table.sheet, row=row_number, address_value=values.get("ip_address"),
                    label=values.get("hostname") or values.get("purpose"), purpose=values.get("purpose"),
                    notes=values.get("notes"), supplied=values,
                )
                if plan and values.get("port") not in {None, ""}:
                    ports = _split_ports(values.get("port"))
                    protocols = _split_protocols(values.get("protocol"))
                    if not ports:
                        issues.append({"sheet": table.sheet, "row": row_number, "field": "Port", "message": "Enter a port from 1 to 65535."})
                    if not protocols:
                        issues.append({"sheet": table.sheet, "row": row_number, "field": "Protocol", "message": "Protocol must contain TCP or UDP."})
                    for port_number in ports:
                        for protocol in protocols:
                            port_plans.setdefault((plan["IP Address"].casefold(), port_number, protocol), {
                                "asset": plan, "port": port_number, "protocol": protocol,
                                "service": _service_for(port_number, values.get("port_service") or values.get("services")),
                                "notes": values.get("notes"),
                            })
                continue

            has_environment = has_environment or values.get("environment") not in {None, ""}
            has_connection_status = has_connection_status or values.get("status") not in {None, ""}
            source = plan_asset(
                sheet=table.sheet, row=row_number, address_value=values.get("source_ip"),
                label=values.get("source_name"), purpose=values.get("source_name"), notes=values.get("notes"),
                supplied={"environment": values.get("environment")},
            )
            destination = plan_asset(
                sheet=table.sheet, row=row_number, address_value=values.get("destination_ip"),
                label=values.get("destination_name"), purpose="Network destination",
                supplied={"environment": values.get("environment")},
            )
            ports = _split_ports(values.get("port"))
            protocols = _split_protocols(values.get("protocol"))
            if not ports:
                issues.append({"sheet": table.sheet, "row": row_number, "field": "Port", "message": "Enter a destination port from 1 to 65535."})
            if not protocols:
                issues.append({"sheet": table.sheet, "row": row_number, "field": "Protocol", "message": "Protocol must contain TCP or UDP."})
            if not source or not destination:
                continue
            source_key = source["IP Address"].casefold()
            destination_key = destination["IP Address"].casefold()
            if source_key == destination_key:
                issues.append({"sheet": table.sheet, "row": row_number, "field": "Destination IP", "message": "Source and destination cannot be the same asset."})
                continue
            graph[source_key].add(destination_key)
            graph[destination_key].add(source_key)
            explicit_status = _normalized_choice(
                values.get("status"), CONNECTION_STATUSES,
                {"open": "connected", "allowed": "connected", "allow": "connected", "denied": "closed", "blocked": "closed", "not_required": "not_needed"},
            )
            if values.get("status") not in {None, ""} and explicit_status is None:
                issues.append({"sheet": table.sheet, "row": row_number, "field": "Status", "message": "Use Connected, Closed, or Not needed."})
            for port_number in ports:
                for protocol in protocols:
                    port_key = (destination_key, port_number, protocol)
                    port_plan = port_plans.setdefault(port_key, {
                        "asset": destination, "port": port_number, "protocol": protocol,
                        "service": _service_for(port_number, values.get("service")), "notes": None,
                    })
                    port_plan["notes"] = _merge_text(port_plan.get("notes"), [values.get("notes")])
                    connection_plans.setdefault((source_key, destination_key, port_number, protocol), {
                        "source": source, "port": port_plan, "explicit_status": explicit_status,
                    })

    # A connectivity component must use one environment because the matrix is environment-scoped.
    visited: set[str] = set()
    for root in asset_plans:
        if root in visited:
            continue
        stack = [root]
        component: set[str] = set()
        while stack:
            current = stack.pop()
            if current in component:
                continue
            component.add(current)
            stack.extend(graph.get(current, set()) - component)
        visited.update(component)
        existing_environments = {
            asset_plans[key]["existing"].environment
            for key in component if asset_plans[key]["existing"] is not None
        }
        if len(existing_environments) > 1:
            issues.append({
                "sheet": "Workbook", "row": 0, "field": "Environment",
                "message": "Connected existing assets belong to different environments. Correct their environments before importing this network table.",
            })
        selected_environment = next(iter(existing_environments), default_environment)
        for key in component:
            if asset_plans[key]["existing"] is None and not has_environment:
                asset_plans[key]["Environment"] = selected_environment

    for plan in asset_plans.values():
        label_note = None
        if len(plan["_labels"]) > 1:
            label_note = "Imported labels: " + ", ".join(plan["_labels"])
        plan["Notes"] = _merge_text(plan["Notes"], [label_note, *plan["_notes"]])

    asset_records = [
        {header: plan.get(header) for header in ASSET_HEADERS}
        for plan in asset_plans.values()
    ]
    port_records: list[dict[str, Any]] = []
    for plan in port_plans.values():
        asset = plan["asset"]
        existing_asset = asset["existing"]
        existing_port = port_by_key.get((existing_asset.id, plan["port"], plan["protocol"])) if existing_asset else None
        port_records.append({
            "Port ID": existing_port.id if existing_port else None,
            "Asset ID": existing_asset.id if existing_asset else None,
            "Hostname": asset["Hostname"], "IP Address": asset["IP Address"],
            "Port": plan["port"], "Protocol": plan["protocol"],
            "Service": existing_port.service if existing_port and existing_port.service else plan["service"],
            "Notes": _merge_text(existing_port.notes if existing_port else None, [plan.get("notes")]),
        })
        plan["existing"] = existing_port

    connection_records: list[dict[str, Any]] = []
    for plan in connection_plans.values():
        source = plan["source"]
        port_plan = plan["port"]
        destination = port_plan["asset"]
        existing_connection = None
        if source["existing"] and port_plan.get("existing"):
            existing_connection = connection_by_key.get((source["existing"].id, port_plan["existing"].id))
        status = plan["explicit_status"] or (existing_connection.status if existing_connection else default_connection_status)
        connection_records.append({
            "Connection ID": existing_connection.id if existing_connection else None,
            "Source Asset ID": source["existing"].id if source["existing"] else None,
            "Source Hostname": source["Hostname"], "Source IP": source["IP Address"],
            "Destination Asset ID": destination["existing"].id if destination["existing"] else None,
            "Destination Hostname": destination["Hostname"], "Destination IP": destination["IP Address"],
            "Port ID": port_plan["existing"].id if port_plan.get("existing") else None,
            "Port": port_plan["port"], "Protocol": port_plan["protocol"],
            "Service": port_plan["service"], "Status": status,
        })

    kinds = {table.kind for table in accepted}
    detected_format = "network_allowlist" if kinds == {"network"} else "asset_register" if kinds == {"asset"} else "mixed_asset_workbook"
    manual_fields: list[str] = []
    if not has_environment:
        manual_fields.append(f"Environment was missing; new assets use {default_environment.replace('_', ' ').title()} and can be completed later.")
    if "network" in kinds and not has_connection_status:
        manual_fields.append(f"Connection status was missing; new rules use {default_connection_status.replace('_', ' ').title()}.")
    manual_fields.append("CPU, memory, storage, operating system, and ownership remain blank when the workbook does not provide them.")
    if any(table.kind == "network" for table in accepted):
        warnings.append("Network rows were consolidated by IP. Repeated assets and repeated ports will not create duplicates.")
        if any(
            len(_split_protocols(_cell_value(cells, "protocol", sheet=table.sheet, row=row, issues=[]))) > 1
            for table in accepted if table.kind == "network" for row, cells in table.records()
        ):
            warnings.append("Multi-protocol cells were expanded into separate TCP and UDP rules.")
    metadata = {**_metadata(accepted, "assets", detected_format), "manual_fields": manual_fields}
    canonical = {
        "Assets": _canonical_sheet(ASSET_HEADERS, asset_records),
        "Ports": _canonical_sheet(PORT_HEADERS, port_records),
        "Connection Log": _canonical_sheet(CONNECTION_HEADERS, connection_records),
    }
    return canonical, metadata, warnings, issues, source_rows


def _status(value: Any) -> str:
    normalized = _normalized(value).replace(" ", "_")
    aliases = {
        "": "todo", "to_do": "todo", "not_started": "todo", "open": "todo", "backlog": "todo",
        "doing": "in_progress", "ongoing": "in_progress", "wip": "in_progress",
        "review": "in_review", "qa": "in_review", "quality_assurance": "in_review",
        "on_hold": "blocked", "hold": "blocked", "complete": "done", "completed": "done", "closed": "done",
    }
    return aliases.get(normalized, normalized if normalized in TASK_STATUSES else "todo")


def _assignee_tokens(value: Any) -> list[str]:
    return [token.strip() for token in re.split(r"[,;\n|]+", str(value or "")) if token.strip()]


def prepare_flexible_kanban_workbook(
    db: Session,
    *,
    project: Project,
    user: User,
    workbook: dict[str, list[WorkbookRow]],
) -> tuple[dict[str, list[WorkbookRow]], dict[str, Any], list[str], list[dict[str, Any]], int]:
    tables = detect_tables(workbook)
    accepted = [table for table in tables if table.kind in {"task", "milestone"}]
    warnings: list[str] = []
    issues: list[dict[str, Any]] = []
    source_rows = sum(len(table.records()) for table in accepted)
    if not accepted:
        suggested = "assets" if any(table.kind in {"network", "asset"} for table in tables) else "kanban"
        message = (
            "This workbook contains asset or network data, not Kanban work. Open Asset inventory and import it there."
            if suggested == "assets"
            else "TrackerX could not find a task or milestone table. Include a Task/Title column plus status, milestone, assignee, or schedule columns."
        )
        return {}, {**_metadata(tables, suggested, "unrecognized"), "manual_fields": []}, warnings, [
            {"sheet": "Workbook", "row": 0, "field": "Structure", "message": message}
        ], source_rows

    members = db.query(TeamMember).filter(TeamMember.is_active == 1).all()
    member_lookup: dict[str, TeamMember] = {}
    for member in members:
        for candidate in (member.employee_number, member.name, member.user.email if member.user else None):
            if candidate:
                key = _normalized(candidate)
                member_lookup[key] = member
                if str(candidate).isdigit():
                    member_lookup[str(candidate).zfill(4)] = member
    allowed_ids = {member.id for member in project.assigned_members}
    if project.project_manager_id:
        allowed_ids.add(project.project_manager_id)

    milestones: dict[str, dict[str, Any]] = {}
    task_records: list[dict[str, Any]] = []
    missing_status = False
    missing_milestone = False
    missing_assignee = False

    def milestone_record(title_value: Any, *, values: dict[str, Any] | None = None) -> dict[str, Any]:
        title = str(title_value or "Imported work").strip()[:300] or "Imported work"
        key = title.casefold()
        record = milestones.get(key)
        if record is None:
            values = values or {}
            record = {
                "Milestone ID": values.get("milestone_id"), "Title": title,
                "Description": values.get("description"), "Start Date": values.get("start_date"),
                "End Date": values.get("end_date"), "Sort Order": values.get("sort_order", len(milestones)),
            }
            milestones[key] = record
        return record

    for table in accepted:
        for row_number, cells in table.records():
            values = {
                field: _cell_value(cells, field, sheet=table.sheet, row=row_number, issues=issues)
                for field in table.columns
            }
            if table.kind == "milestone":
                title = values.get("title")
                if not title:
                    issues.append({"sheet": table.sheet, "row": row_number, "field": "Milestone", "message": "Milestone title is required."})
                    continue
                milestone_record(title, values=values)
                continue

            title = values.get("title")
            if not title:
                issues.append({"sheet": table.sheet, "row": row_number, "field": "Task title", "message": "Task title is required."})
                continue
            milestone_title = values.get("milestone_title")
            if not milestone_title:
                sheet_title = table.sheet.strip()
                milestone_title = sheet_title if _normalized(sheet_title) not in {"sheet1", "tasks", "task", "kanban"} else "Imported work"
                missing_milestone = True
            milestone = milestone_record(milestone_title)
            raw_status = values.get("status")
            if raw_status in {None, ""}:
                missing_status = True
            normalized_status = _status(raw_status)
            if raw_status not in {None, ""} and normalized_status == "todo" and _normalized(raw_status).replace(" ", "_") not in {"todo", "to_do", "not_started", "open", "backlog"}:
                warnings.append(f"{table.sheet} row {row_number}: unknown status '{raw_status}' was set to To do.")
            selected_numbers: list[str] = []
            raw_assignees = values.get("assignees")
            if raw_assignees in {None, ""}:
                missing_assignee = True
            for token in _assignee_tokens(raw_assignees):
                member = member_lookup.get(_normalized(token)) or member_lookup.get(token.zfill(4) if token.isdigit() else "")
                if member is None:
                    warnings.append(f"{table.sheet} row {row_number}: assignee '{token}' was not matched and can be assigned later.")
                    continue
                if user.role == "pm" and member.id not in allowed_ids:
                    issues.append({"sheet": table.sheet, "row": row_number, "field": "Assignees", "message": f"{member.name} is not assigned to this project team."})
                    continue
                number = str(member.employee_number or member.id).zfill(4)
                if number not in selected_numbers:
                    selected_numbers.append(number)
            task_records.append({
                "Task ID": values.get("task_id"), "Milestone ID": values.get("milestone_id"),
                "Milestone Title": milestone["Title"], "Title": str(title).strip()[:300],
                "Description": values.get("description"), "Status": normalized_status,
                "Assignee Employee IDs": ", ".join(selected_numbers),
                "Start Date": values.get("start_date"), "End Date": values.get("end_date"),
                "Estimated Days": values.get("estimated_days"), "Is Delayed": values.get("is_delayed") or "No",
                "Delay Cause": values.get("delay_cause"), "Delay Comment": values.get("delay_comment"),
                "Sort Order": values.get("sort_order", len(task_records)),
            })

    manual_fields: list[str] = []
    if missing_milestone:
        manual_fields.append("Missing milestones were grouped under the worksheet name or Imported work; you can reorganize them later.")
    if missing_status:
        manual_fields.append("Missing task statuses were set to To do.")
    if missing_assignee:
        manual_fields.append("Tasks without a recognized assignee remain unassigned for manual completion.")
    manual_fields.append("Dates, estimates, descriptions, and delay details remain blank when the workbook does not provide them.")
    warnings.append("External rows without TrackerX IDs create new tasks. Existing work is updated only when a valid TrackerX ID is supplied.")
    kinds = {table.kind for table in accepted}
    detected_format = "task_list" if kinds == {"task"} else "milestone_plan" if kinds == {"milestone"} else "kanban_plan"
    metadata = {**_metadata(accepted, "kanban", detected_format), "manual_fields": manual_fields}
    canonical = {
        "Milestones": _canonical_sheet(MILESTONE_HEADERS, list(milestones.values())),
        "Tasks": _canonical_sheet(TASK_HEADERS, task_records),
    }
    return canonical, metadata, warnings, issues, source_rows


def trackerx_metadata(workspace: str, workbook: dict[str, list[WorkbookRow]]) -> dict[str, Any]:
    sheets = list(workbook)
    return {
        "detected_format": f"trackerx_{workspace}_workbook",
        "suggested_workspace": workspace,
        "detected_tables": [
            {"sheet": sheet, "kind": "trackerx", "header_row": None, "confidence": 100, "rows": max(0, len(workbook[sheet]) - 1), "mapping": []}
            for sheet in sheets
        ],
        "manual_fields": [],
    }
