from __future__ import annotations

import os
from pathlib import Path
import tempfile
import unittest

_shared_test_database = Path(tempfile.gettempdir()) / "trackerx_unit_tests.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_shared_test_database.as_posix()}")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import Project, ProactiveServiceReport, User
from app.routers.support import _report_out, _validate_report, export_proactive_report_pdf


class SupportReportTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_custom_service_name_is_preserved_and_exported(self):
        with Session(self.engine) as db:
            admin = User(email="admin@example.com", hashed_password="unused", full_name="TrackerX Admin", role="admin", access_level="write")
            project = Project(name="Client Support", project_type="maintenance_support")
            report = ProactiveServiceReport(project=project, category="updates", service_area_name="Database Continuity Review", title="Continuity Report", status="completed", executive_summary="Service remained available.", findings="No replication lag found.", work_completed="Failover was tested.", recommendations="Repeat quarterly.")
            db.add_all([admin, report])
            db.commit()
            payload = _report_out(report)
            response = export_proactive_report_pdf(report.id, db=db, user=admin)

            self.assertEqual(payload["service_area_name"], "Database Continuity Review")
            self.assertEqual(response.media_type, "application/pdf")
            self.assertTrue(response.body.startswith(b"%PDF-"))
            self.assertGreater(len(response.body), 8_000)

    def test_completed_report_requires_all_client_sections(self):
        with self.assertRaises(Exception):
            _validate_report({"category": "health_check", "status": "completed"})


if __name__ == "__main__":
    unittest.main()
