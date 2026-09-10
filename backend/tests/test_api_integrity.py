from __future__ import annotations

import os
from pathlib import Path
import re
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# This module is discovered before the rest of the suite. Establish a disposable
# database before importing the application so no shared engine can point at a
# developer or production database during tests.
_shared_test_database = Path(tempfile.gettempdir()) / "trackerx_unit_tests.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_shared_test_database.as_posix()}")
os.environ.setdefault("BACKUP_ON_STARTUP", "false")

from app.db import Base
from app.main import app
from app.models import Meeting, Milestone, Project, TeamMember, User
from app.routers.meetings import create_meeting, delete_meeting, update_meeting
from app.routers.milestones import create_milestone, delete_milestone, update_milestone
from app.schemas.meeting import MeetingInput, MeetingUpdate
from app.schemas.milestone import MilestoneInput, MilestoneUpdate


class ApiIntegrityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.admin = User(
            email="owner@api.test",
            hashed_password="x",
            full_name="Owner",
            role="admin",
            access_level="write",
            is_enabled=1,
        )
        self.pm_user = User(
            email="pm@api.test",
            hashed_password="x",
            full_name="Project Manager",
            role="pm",
            access_level="write",
            is_enabled=1,
        )
        self.db.add_all([self.admin, self.pm_user])
        self.db.flush()
        self.pm = TeamMember(
            employee_number="0099",
            name="Project Manager",
            role="Project Manager",
            user_id=self.pm_user.id,
            is_active=1,
        )
        self.db.add(self.pm)
        self.db.flush()
        self.project = Project(
            name="API Integrity Project",
            project_type="actual_project",
            project_manager_id=self.pm.id,
            status="active",
        )
        self.db.add(self.project)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_every_openapi_operation_has_a_unique_method_and_path(self) -> None:
        schema = app.openapi()
        operations: set[tuple[str, str]] = set()
        for path, path_item in schema["paths"].items():
            for method in path_item:
                if method.lower() not in {"get", "post", "put", "patch", "delete"}:
                    continue
                operation = (method.upper(), path)
                self.assertNotIn(operation, operations)
                operations.add(operation)
        self.assertGreaterEqual(len(operations), 100)

    def test_every_api_route_handles_an_unauthenticated_request_without_500(self) -> None:
        failures: list[str] = []
        schema = app.openapi()
        with TestClient(app, raise_server_exceptions=False) as client:
            for route_path, path_item in schema["paths"].items():
                path = re.sub(r"\{[^}]+\}", "999999", route_path)
                for method_name in path_item:
                    method = method_name.upper()
                    if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                        continue
                    response = client.request(method, path, json={} if method != "GET" else None)
                    if response.status_code >= 500:
                        failures.append(f"{method} {route_path}: {response.status_code}")
        self.assertEqual(failures, [])

    def test_project_manager_can_create_edit_and_delete_milestones(self) -> None:
        created = create_milestone(
            self.project.id,
            MilestoneInput(title="Foundation", description="Delivery baseline"),
            db=self.db,
            user=self.pm_user,
        )
        updated = update_milestone(
            created["id"],
            MilestoneUpdate(title="Foundation complete", start_date="2026-09-10"),
            db=self.db,
            user=self.pm_user,
        )
        self.assertEqual(updated["title"], "Foundation complete")
        delete_milestone(created["id"], db=self.db, user=self.pm_user)
        self.assertIsNone(self.db.get(Milestone, created["id"]))

    def test_project_manager_can_create_edit_and_delete_meetings(self) -> None:
        created = create_meeting(
            self.project.id,
            MeetingInput(
                meeting_type="sprint",
                title="Weekly delivery review",
                meeting_date="2026-09-10",
            ),
            db=self.db,
            user=self.pm_user,
        )
        meeting_id = created.id
        updated = update_meeting(
            meeting_id,
            MeetingUpdate(title="Weekly delivery review updated"),
            db=self.db,
            user=self.pm_user,
        )
        self.assertEqual(updated.title, "Weekly delivery review updated")
        delete_meeting(meeting_id, db=self.db, user=self.pm_user)
        self.assertIsNone(self.db.get(Meeting, meeting_id))


if __name__ == "__main__":
    unittest.main()
