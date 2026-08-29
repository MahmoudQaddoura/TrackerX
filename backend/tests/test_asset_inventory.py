from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.load_asset_inventory import load_inventory
from app.models import Asset, AssetConnection, Project


class AssetInventoryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            db.add(Project(id=1, name="Test project", project_type="actual_project"))
            db.commit()

    def tearDown(self):
        self.engine.dispose()

    def test_workbook_seed_is_idempotent_and_keeps_ports_independent(self):
        with Session(self.engine) as db:
            first = load_inventory(db, 1)
            second = load_inventory(db, 1)

            self.assertEqual(first["assets_created"], 6)
            self.assertEqual(first["ports_created"], 7)
            self.assertEqual(second["assets_created"], 0)
            self.assertEqual(second["ports_created"], 0)
            self.assertEqual(db.query(Asset).filter(Asset.project_id == 1).count(), 6)

            web = db.query(Asset).filter(Asset.hostname == "prod-web-01").one()
            app = db.query(Asset).filter(Asset.hostname == "prod-app-01").one()
            self.assertEqual([port.port for port in web.ports], [443, 3443])

            states = {
                connection.port_record.port: connection.status
                for connection in db.query(AssetConnection)
                .filter(AssetConnection.source_asset_id == app.id)
                .all()
                if connection.port_record.asset_id == web.id
            }
            self.assertEqual(states, {443: "closed", 3443: "connected"})
