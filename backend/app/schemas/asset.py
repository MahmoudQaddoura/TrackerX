from __future__ import annotations

"""Request and response schemas for the project asset registry."""

from pydantic import BaseModel, Field


class AssetInput(BaseModel):
    hostname: str = Field(min_length=1, max_length=150)
    ip_address: str = Field(min_length=1, max_length=64)
    environment: str = "production"
    purpose: str | None = None
    tier: str | None = None
    os: str | None = None
    cpu: str | None = None
    ram: str | None = None
    storage: str | None = None
    applications: str | None = None
    database: str | None = None
    services: str | None = None
    status: str = "active"
    notes: str | None = None


class AssetUpdate(BaseModel):
    hostname: str | None = Field(default=None, min_length=1, max_length=150)
    ip_address: str | None = Field(default=None, min_length=1, max_length=64)
    environment: str | None = None
    purpose: str | None = None
    tier: str | None = None
    os: str | None = None
    cpu: str | None = None
    ram: str | None = None
    storage: str | None = None
    applications: str | None = None
    database: str | None = None
    services: str | None = None
    status: str | None = None
    notes: str | None = None


class AssetPortInput(BaseModel):
    port: int = Field(ge=1, le=65535)
    protocol: str = "tcp"
    service: str = Field(min_length=1, max_length=120)
    notes: str | None = None


class AssetPortOut(BaseModel):
    id: int
    asset_id: int
    port: int
    protocol: str
    service: str
    notes: str | None
    created_at: str
    updated_at: str


class AssetOut(BaseModel):
    id: int
    project_id: int
    hostname: str
    ip_address: str
    environment: str
    purpose: str | None
    tier: str | None
    os: str | None
    cpu: str | None
    ram: str | None
    storage: str | None
    applications: str | None
    database: str | None
    services: str | None
    status: str
    notes: str | None
    ports: list[AssetPortOut]
    created_by_name: str | None
    created_at: str
    updated_at: str


class AssetConnectionInput(BaseModel):
    status: str


class AssetConnectionOut(BaseModel):
    id: int
    source_asset_id: int
    port_id: int
    status: str
    updated_at: str


class AssetMatrixOut(BaseModel):
    environment: str
    assets: list[AssetOut]
    connections: list[AssetConnectionOut]
