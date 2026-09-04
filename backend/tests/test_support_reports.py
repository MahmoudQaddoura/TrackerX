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
from app.models import Project, ProactiveServiceReport, SupportIncident, User
from app.routers.support import _incident_out, _report_out, _validate_report, export_incident_report_pdf, export_proactive_report_pdf


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

    def test_incident_preserves_detection_and_response_phases_in_pdf(self):
        with Session(self.engine) as db:
            admin = User(email="incident@example.com", hashed_password="unused", full_name="TrackerX Admin", role="admin", access_level="write")
            project = Project(name="VerifyX Support", project_type="maintenance_support")
            incident = SupportIncident(project=project, title="API unavailable", detection_source="client", reported_by_name="PSUT Service Desk", affected_service="VerifyX API", client_report="HTTP 503 reported", description="Authentication unavailable", reported_at="2026-09-05T09:00", severity="high", status="resolved", containment_actions="Traffic routed to standby", investigation="Application logs reviewed", root_cause="Expired upstream credential", response_at="2026-09-05T09:08", response_description="Credential rotated", recovery_validation="Login tests passed", resolution_notes="Service restored", lessons_learned="Add credential expiry alert")
            db.add_all([admin, incident]); db.commit()

            payload = _incident_out(incident)
            response = export_incident_report_pdf(incident.id, db=db, user=admin)

            self.assertEqual(payload["detection_source"], "client")
            self.assertEqual(payload["root_cause"], "Expired upstream credential")
            self.assertEqual(response.media_type, "application/pdf")
            self.assertTrue(response.body.startswith(b"%PDF-"))
            self.assertGreater(len(response.body), 8_000)


if __name__ == "__main__":
    unittest.main()
