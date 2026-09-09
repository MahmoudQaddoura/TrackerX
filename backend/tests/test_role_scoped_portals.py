from __future__ import annotations

import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.deps import check_project_manage_access, get_accessible_project_ids
from app.models import Notification, Project, TeamMember, User
from app.routers.attendance import _scoped_members
from app.routers.projects import get_project_team, replace_project_team
from app.routers.tasks import _validate_pm_roster
from app.schemas.project import ProjectTeamInput


class RoleScopedPortalTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        self.admin = User(email="owner@test.local", hashed_password="x", full_name="Owner", role="admin", access_level="write", is_enabled=1)
        self.pm_user = User(email="pm@test.local", hashed_password="x", full_name="Project Manager", role="pm", access_level="write", is_enabled=1)
        self.other_pm_user = User(email="other-pm@test.local", hashed_password="x", full_name="Other PM", role="pm", access_level="write", is_enabled=1)
        self.dev_user = User(email="dev@test.local", hashed_password="x", full_name="Developer", role="developer", access_level="write", is_enabled=1)
        self.client_user = User(email="client@test.local", hashed_password="x", full_name="Client", role="client", access_level="read", is_enabled=1)
        self.db.add_all([self.admin, self.pm_user, self.other_pm_user, self.dev_user, self.client_user])
        self.db.flush()

        self.pm = TeamMember(employee_number="0002", name="Project Manager", role="PM", user_id=self.pm_user.id, is_active=1)
        self.other_pm = TeamMember(employee_number="0003", name="Other PM", role="PM", user_id=self.other_pm_user.id, is_active=1)
        self.dev = TeamMember(employee_number="0004", name="Developer", role="Engineer", user_id=self.dev_user.id, is_active=1)
        self.outside = TeamMember(employee_number="0005", name="Outside Developer", role="Engineer", is_active=1)
        self.db.add_all([self.pm, self.other_pm, self.dev, self.outside])
        self.db.flush()

        self.project_one = Project(name="Project One", project_manager_id=self.pm.id, status="active")
        self.project_two = Project(name="Project Two", project_manager_id=self.pm.id, status="active")
        self.other_project = Project(name="Other Project", project_manager_id=self.other_pm.id, status="active")
        self.db.add_all([self.project_one, self.project_two, self.other_project])
        self.db.flush()
        self.project_one.assigned_members = [self.pm]
        self.project_two.assigned_members = [self.pm]
        self.other_project.assigned_members = [self.other_pm]
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_one_manager_can_lead_multiple_separately_scoped_projects(self) -> None:
        accessible = get_accessible_project_ids(self.pm_user, self.db)
        self.assertIn(self.project_one.id, accessible)
        self.assertIn(self.project_two.id, accessible)
        self.assertNotIn(self.other_project.id, accessible)
        check_project_manage_access(self.db, self.pm_user, self.project_one.id)
        with self.assertRaises(HTTPException) as error:
            check_project_manage_access(self.db, self.pm_user, self.other_project.id)
        self.assertEqual(error.exception.status_code, 403)

    def test_pm_can_replace_only_their_project_roster_and_employee_is_notified(self) -> None:
        result = replace_project_team(
            self.project_one.id,
            ProjectTeamInput(member_ids=[self.dev.id]),
            db=self.db,
            user=self.pm_user,
        )
        self.assertEqual({member["id"] for member in result}, {self.pm.id, self.dev.id})
        notice = self.db.query(Notification).filter(Notification.user_id == self.dev_user.id).one()
        self.assertEqual(notice.kind, "project_assignment")
        self.assertIn("Project One", notice.title)

        with self.assertRaises(HTTPException) as error:
            replace_project_team(
                self.other_project.id,
                ProjectTeamInput(member_ids=[self.dev.id]),
                db=self.db,
                user=self.pm_user,
            )
        self.assertEqual(error.exception.status_code, 403)

    def test_pm_task_assignment_is_limited_to_project_roster(self) -> None:
        self.project_one.assigned_members = [self.pm, self.dev]
        _validate_pm_roster(self.pm_user, self.project_one, [self.dev])
        with self.assertRaises(HTTPException) as error:
            _validate_pm_roster(self.pm_user, self.project_one, [self.outside])
        self.assertEqual(error.exception.status_code, 422)

    def test_pm_attendance_scope_is_self_only(self) -> None:
        self.assertEqual([member.id for member in _scoped_members(self.db, self.pm_user)], [self.pm.id])
        self.assertGreaterEqual(len(_scoped_members(self.db, self.admin)), 4)

    def test_client_cannot_read_internal_project_team(self) -> None:
        with self.assertRaises(HTTPException) as error:
            get_project_team(self.project_one.id, db=self.db, user=self.client_user)
        self.assertEqual(error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
