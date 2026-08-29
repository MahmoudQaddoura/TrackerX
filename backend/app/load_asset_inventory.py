from __future__ import annotations

"""Idempotently load the approved asset workbook data into one TrackerX project."""

import argparse

from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine
from app.models import Asset, AssetConnection, AssetPort, Project

ASSETS = [
    {
        "key": "a1",
        "hostname": "prod-web-01",
        "ip_address": "10.10.1.10",
        "environment": "production",
        "purpose": "Public web frontend",
        "tier": "Web",
        "os": "Rocky Linux 9",
        "cpu": "4 vCPU",
        "ram": "16 GB",
        "storage": "200 GB SSD",
        "applications": "Customer Portal",
        "database": "N/A",
        "services": "Nginx",
        "status": "active",
        "notes": "Primary production web server",
    },
    {
        "key": "a2",
        "hostname": "prod-app-01",
        "ip_address": "10.10.1.20",
        "environment": "production",
        "purpose": "Application backend",
        "tier": "Application",
        "os": "Rocky Linux 9",
        "cpu": "8 vCPU",
        "ram": "32 GB",
        "storage": "500 GB SSD",
        "applications": "Core API",
        "database": "PostgreSQL 16",
        "services": "Docker, Nginx",
        "status": "active",
        "notes": "Main backend application",
    },
    {
        "key": "a3",
        "hostname": "prod-db-01",
        "ip_address": "10.10.1.30",
        "environment": "production",
        "purpose": "Production database",
        "tier": "Database",
        "os": "Rocky Linux 9",
        "cpu": "8 vCPU",
        "ram": "32 GB",
        "storage": "1 TB SSD",
        "applications": "N/A",
        "database": "PostgreSQL 16",
        "services": "PostgreSQL",
        "status": "active",
        "notes": "Primary application database",
    },
    {
        "key": "a4",
        "hostname": "stage-web-01",
        "ip_address": "10.20.1.10",
        "environment": "staging",
        "purpose": "Staging web frontend",
        "tier": "Web",
        "os": "Rocky Linux 9",
        "cpu": "4 vCPU",
        "ram": "16 GB",
        "storage": "200 GB SSD",
        "applications": "Customer Portal",
        "database": "N/A",
        "services": "Nginx",
        "status": "active",
        "notes": "Staging web environment",
    },
    {
        "key": "a5",
        "hostname": "stage-app-01",
        "ip_address": "10.20.1.20",
        "environment": "staging",
        "purpose": "Staging application backend",
        "tier": "Application",
        "os": "Ubuntu 24.04",
        "cpu": "4 vCPU",
        "ram": "16 GB",
        "storage": "300 GB SSD",
        "applications": "Core API",
        "database": "PostgreSQL 16",
        "services": "Docker, Nginx",
        "status": "active",
        "notes": "Used for application testing",
    },
    {
        "key": "a6",
        "hostname": "stage-db-01",
        "ip_address": "10.20.1.30",
        "environment": "staging",
        "purpose": "Staging database",
        "tier": "Database",
        "os": "Ubuntu 24.04",
        "cpu": "4 vCPU",
        "ram": "16 GB",
        "storage": "500 GB SSD",
        "applications": "N/A",
        "database": "PostgreSQL 16",
        "services": "PostgreSQL",
        "status": "maintenance",
        "notes": "Currently undergoing maintenance",
    },
]

PORTS = [
    ("p1", "a1", 443, "tcp", "HTTPS"),
    ("p2", "a1", 3443, "tcp", "Admin Console"),
    ("p3", "a2", 8443, "tcp", "API"),
    ("p4", "a3", 5432, "tcp", "PostgreSQL"),
    ("p5", "a4", 443, "tcp", "HTTPS"),
    ("p6", "a5", 8443, "tcp", "API"),
    ("p7", "a6", 5432, "tcp", "PostgreSQL"),
]

CONNECTIONS = [
    ("a2", "p1", "closed"),
    ("a3", "p1", "not_needed"),
    ("a2", "p2", "connected"),
    ("a3", "p2", "not_needed"),
    ("a1", "p3", "connected"),
    ("a3", "p3", "closed"),
    ("a1", "p4", "not_needed"),
    ("a2", "p4", "connected"),
    ("a5", "p5", "closed"),
    ("a6", "p5", "not_needed"),
    ("a4", "p6", "connected"),
    ("a6", "p6", "closed"),
    ("a4", "p7", "not_needed"),
    ("a5", "p7", "connected"),
]


def load_inventory(db: Session, project_id: int) -> dict[str, int]:
    project = db.get(Project, project_id)
    if project is None:
        raise ValueError(f"Project {project_id} does not exist.")

    assets_by_key: dict[str, Asset] = {}
    created_assets = 0
    created_ports = 0
    updated_connections = 0

    for record in ASSETS:
        data = dict(record)
        key = data.pop("key")
        asset = (
            db.query(Asset)
            .filter(Asset.project_id == project_id, Asset.hostname == data["hostname"])
            .first()
        )
        if asset is None:
            asset = Asset(project_id=project_id, **data)
            db.add(asset)
            db.flush()
            created_assets += 1
        else:
            for field, value in data.items():
                setattr(asset, field, value)
        assets_by_key[key] = asset

    ports_by_key: dict[str, AssetPort] = {}
    for key, asset_key, port_number, protocol, service in PORTS:
        asset = assets_by_key[asset_key]
        port = (
            db.query(AssetPort)
            .filter(
                AssetPort.asset_id == asset.id,
                AssetPort.port == port_number,
                AssetPort.protocol == protocol,
            )
            .first()
        )
        if port is None:
            port = AssetPort(
                asset_id=asset.id,
                port=port_number,
                protocol=protocol,
                service=service,
            )
            db.add(port)
            db.flush()
            created_ports += 1
        else:
            port.service = service
        ports_by_key[key] = port

    for source_key, port_key, status in CONNECTIONS:
        source = assets_by_key[source_key]
        port = ports_by_key[port_key]
        connection = (
            db.query(AssetConnection)
            .filter(
                AssetConnection.source_asset_id == source.id,
                AssetConnection.port_id == port.id,
            )
            .first()
        )
        if connection is None:
            connection = AssetConnection(
                source_asset_id=source.id,
                port_id=port.id,
                status=status,
            )
            db.add(connection)
        else:
            connection.status = status
        updated_connections += 1

    db.commit()
    return {
        "project_id": project_id,
        "assets_created": created_assets,
        "ports_created": created_ports,
        "connections_loaded": updated_connections,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the TrackerX asset workbook data.")
    parser.add_argument("--project-id", type=int, default=1)
    args = parser.parse_args()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        print(load_inventory(db, args.project_id))


if __name__ == "__main__":
    main()
