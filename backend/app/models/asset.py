from __future__ import annotations

"""Project-scoped infrastructure assets and port-level network rules."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db import Base, now_iso

ASSET_ENVIRONMENTS = (
    "production",
    "staging",
    "development",
    "test",
    "disaster_recovery",
    "other",
)
ASSET_STATUSES = ("active", "maintenance", "inactive", "retired")
PORT_PROTOCOLS = ("tcp", "udp")
CONNECTION_STATUSES = ("connected", "closed", "not_needed")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hostname = Column(Text, nullable=False)
    ip_address = Column(Text, nullable=False)
    environment = Column(Text, nullable=False, default="production", index=True)
    purpose = Column(Text, nullable=True)
    tier = Column(Text, nullable=True)
    os = Column(Text, nullable=True)
    cpu = Column(Text, nullable=True)
    ram = Column(Text, nullable=True)
    storage = Column(Text, nullable=True)
    applications = Column(Text, nullable=True)
    database = Column(Text, nullable=True)
    services = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="active", index=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    project = relationship("Project", back_populates="assets")
    created_by = relationship("User")
    ports = relationship(
        "AssetPort",
        back_populates="asset",
        cascade="all, delete-orphan",
        order_by="AssetPort.port",
    )
    source_connections = relationship(
        "AssetConnection",
        foreign_keys="AssetConnection.source_asset_id",
        back_populates="source_asset",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("project_id", "hostname", name="uq_asset_project_hostname"),
        UniqueConstraint("project_id", "ip_address", name="uq_asset_project_ip"),
        CheckConstraint(
            "environment IN ('production','staging','development','test','disaster_recovery','other')",
            name="ck_asset_environment",
        ),
        CheckConstraint(
            "status IN ('active','maintenance','inactive','retired')",
            name="ck_asset_status",
        ),
    )


class AssetPort(Base):
    __tablename__ = "asset_ports"

    id = Column(Integer, primary_key=True)
    asset_id = Column(
        Integer,
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    port = Column(Integer, nullable=False)
    protocol = Column(Text, nullable=False, default="tcp")
    service = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    asset = relationship("Asset", back_populates="ports")
    connections = relationship(
        "AssetConnection",
        back_populates="port_record",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("asset_id", "port", "protocol", name="uq_asset_port_protocol"),
        CheckConstraint("port >= 1 AND port <= 65535", name="ck_asset_port_range"),
        CheckConstraint("protocol IN ('tcp','udp')", name="ck_asset_port_protocol"),
    )


class AssetConnection(Base):
    __tablename__ = "asset_connections"

    id = Column(Integer, primary_key=True)
    source_asset_id = Column(
        Integer,
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    port_id = Column(
        Integer,
        ForeignKey("asset_ports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(Text, nullable=False, default="not_needed")
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(Text, nullable=False, default=now_iso)
    updated_at = Column(Text, nullable=False, default=now_iso, onupdate=now_iso)

    source_asset = relationship(
        "Asset",
        foreign_keys=[source_asset_id],
        back_populates="source_connections",
    )
    port_record = relationship("AssetPort", back_populates="connections")
    updated_by = relationship("User")

    __table_args__ = (
        UniqueConstraint("source_asset_id", "port_id", name="uq_asset_connection_source_port"),
        CheckConstraint(
            "status IN ('connected','closed','not_needed')",
            name="ck_asset_connection_status",
        ),
    )
