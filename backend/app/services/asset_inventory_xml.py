from __future__ import annotations

"""Build a stable XML representation of one project's complete asset inventory."""

from datetime import datetime
from typing import Any
from xml.etree.ElementTree import Element, SubElement, indent, tostring


def _text_element(parent: Element, name: str, value: Any) -> Element:
    element = SubElement(parent, name)
    if value is not None:
        element.text = str(value)
    return element


def build_asset_inventory_xml(
    project_id: int,
    project_name: str,
    project_type: str,
    assets: list[dict[str, Any]],
    connections: list[dict[str, Any]],
    exported_by: str,
    generated_at: datetime | None = None,
) -> bytes:
    """Return UTF-8 XML containing every asset, port, and recorded connection rule."""

    created = generated_at or datetime.now().astimezone()
    ports = [port for asset in assets for port in asset.get("ports", [])]
    environments = {asset["environment"] for asset in assets}
    root = Element(
        "trackerx_asset_inventory",
        {
            "schema_version": "1.0",
            "generated_at": created.isoformat(timespec="seconds"),
        },
    )

    project = SubElement(
        root,
        "project",
        {"id": str(project_id), "type": project_type},
    )
    _text_element(project, "name", project_name)
    _text_element(project, "exported_by", exported_by)

    summary = SubElement(root, "summary")
    _text_element(summary, "asset_count", len(assets))
    _text_element(summary, "environment_count", len(environments))
    _text_element(summary, "port_count", len(ports))
    _text_element(summary, "connection_count", len(connections))

    asset_collection = SubElement(root, "assets", {"count": str(len(assets))})
    for record in assets:
        asset = SubElement(
            asset_collection,
            "asset",
            {
                "id": str(record["id"]),
                "environment": str(record["environment"]),
                "status": str(record["status"]),
            },
        )
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
            "created_by_name",
            "created_at",
            "updated_at",
        ):
            _text_element(asset, field, record.get(field))

        asset_ports = record.get("ports", [])
        port_collection = SubElement(asset, "ports", {"count": str(len(asset_ports))})
        for record_port in asset_ports:
            port = SubElement(
                port_collection,
                "port",
                {
                    "id": str(record_port["id"]),
                    "number": str(record_port["port"]),
                    "protocol": str(record_port["protocol"]),
                },
            )
            for field in ("service", "notes", "created_at", "updated_at"):
                _text_element(port, field, record_port.get(field))

    connection_collection = SubElement(
        root,
        "connections",
        {"count": str(len(connections))},
    )
    for rule in connections:
        connection = SubElement(
            connection_collection,
            "connection",
            {
                "id": str(rule["id"]),
                "status": str(rule["status"]),
            },
        )
        source = SubElement(
            connection,
            "source",
            {"asset_id": str(rule["source_asset_id"])},
        )
        _text_element(source, "hostname", rule["source_hostname"])
        _text_element(source, "ip_address", rule["source_ip_address"])

        destination = SubElement(
            connection,
            "destination",
            {
                "asset_id": str(rule["destination_asset_id"]),
                "port_id": str(rule["port_id"]),
            },
        )
        _text_element(destination, "hostname", rule["destination_hostname"])
        _text_element(destination, "ip_address", rule["destination_ip_address"])
        _text_element(destination, "port", rule["port"])
        _text_element(destination, "protocol", rule["protocol"])
        _text_element(destination, "service", rule["service"])
        _text_element(connection, "updated_at", rule.get("updated_at"))

    indent(root, space="  ")
    return tostring(root, encoding="utf-8", xml_declaration=True)
