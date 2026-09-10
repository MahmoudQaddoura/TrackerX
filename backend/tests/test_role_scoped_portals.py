from __future__ import annotations

import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.deps import check_project_manage_access, get_accessible_project_ids
from app.models import Notification, Project, TeamMember, User
from app.routers.attendance import _scoped_members, confirm_my_attendance, save_attendance_sheet
from app.routers.leave_requests import create_leave_request, list_leave_requests, review_leave_request
from app.routers.projects import get_project_team, replace_project_team, update_project_manager
from app.routers.tasks import _validate_pm_roster
from app.schemas.project import ProjectManagerInput, ProjectTeamInput
from app.routers.team_members import provision_credentials
from app.schemas.team_member import EmployeeCredentialsInput
from app.schemas.attendance import AttendanceBulkInput, AttendanceInput, AttendanceSelfConfirmationInput
from app.schemas.leave_request import LeaveRequestCreate, LeaveRequestReview


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

        self.owner_member = TeamMember(employee_number="0001", name="Owner", role="Owner", user_id=self.admin.id, is_active=1)
        self.pm = TeamMember(employee_number="0002", name="Project Manager", role="PM", user_id=self.pm_user.id, is_active=1)
        self.other_pm = TeamMember(employee_number="0003", name="Other PM", role="PM", user_id=self.other_pm_user.id, is_active=1)
        self.dev = TeamMember(employee_number="0004", name="Developer", role="Engineer", user_id=self.dev_user.id, is_active=1)
        self.outside = TeamMember(employee_number="0005", name="Outside Developer", role="Engineer", is_active=1)
        self.db.add_all([self.owner_member, self.pm, self.other_pm, self.dev, self.outside])
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

    def test_internal_employee_can_self_confirm_but_client_cannot(self) -> None:
        confirmed = confirm_my_attendance(
            AttendanceSelfConfirmationInput(action="check_in", work_mode="remote"),
            db=self.db,
            user=self.dev_user,
        )
        self.assertEqual(confirmed["status"], "remote")
        self.assertTrue(confirmed["confirmed_by_employee"])
        self.assertIsNotNone(confirmed["check_in"])
        checked_out = confirm_my_attendance(
            AttendanceSelfConfirmationInput(action="check_out", work_mode="remote"),
            db=self.db,
            user=self.dev_user,
        )
        self.assertIsNotNone(checked_out["check_out"])
        unchanged = save_attendance_sheet(
            AttendanceBulkInput(records=[AttendanceInput(
                team_member_id=self.dev.id,
                attendance_date=checked_out["attendance_date"],
                status=checked_out["status"],
                check_in=checked_out["check_in"],
                check_out=checked_out["check_out"],
                notes=checked_out["notes"],
            )]),
            db=self.db,
            admin=self.admin,
        )
        self.assertTrue(next(row for row in unchanged if row["team_member_id"] == self.dev.id)["confirmed_by_employee"])

        with self.assertRaises(HTTPException) as error:
            confirm_my_attendance(
                AttendanceSelfConfirmationInput(action="check_in", work_mode="present"),
                db=self.db,
                user=self.client_user,
            )
        self.assertEqual(error.exception.status_code, 403)

    def test_employee_leave_routes_to_pm_and_admin_but_pm_leave_routes_to_owner(self) -> None:
        self.admin.is_primary_admin = 1
        self.project_one.assigned_members.append(self.dev)
        self.db.commit()

        employee_leave = create_leave_request(
            LeaveRequestCreate(
                request_type="leave",
                start_date="2026-09-15",
                end_date="2026-09-15",
                reason="Personal appointment",
            ),
            db=self.db,
            user=self.dev_user,
        )
        notified_user_ids = {
            notice.user_id
            for notice in self.db.query(Notification).filter(Notification.kind == "leave_request").all()
        }
        self.assertEqual(notified_user_ids, {self.admin.id, self.pm_user.id})
        pm_inbox = list_leave_requests(scope="reviewable", status=None, db=self.db, user=self.pm_user)
        self.assertEqual([request["id"] for request in pm_inbox], [employee_leave["id"]])
        other_pm_inbox = list_leave_requests(scope="reviewable", status=None, db=self.db, user=self.other_pm_user)
        self.assertEqual(other_pm_inbox, [])

        reviewed = review_leave_request(
            employee_leave["id"],
            LeaveRequestReview(status="approved", autofill_attendance=False),
            db=self.db,
            reviewer=self.pm_user,
        )
        self.assertEqual(reviewed["status"], "approved")

        manager_leave = create_leave_request(
            LeaveRequestCreate(
                request_type="leave",
                start_date="2026-09-20",
                end_date="2026-09-20",
                reason="Manager personal leave",
            ),
            db=self.db,
            user=self.pm_user,
        )
        with self.assertRaises(HTTPException) as error:
            review_leave_request(
                manager_leave["id"],
                LeaveRequestReview(status="approved", autofill_attendance=False),
                db=self.db,
                reviewer=self.pm_user,
            )
        self.assertEqual(error.exception.status_code, 403)
        owner_inbox = list_leave_requests(scope="reviewable", status=None, db=self.db, user=self.admin)
        self.assertIn(manager_leave["id"], [request["id"] for request in owner_inbox])

    def test_client_cannot_read_internal_project_team(self) -> None:
        with self.assertRaises(HTTPException) as error:
            get_project_team(self.project_one.id, db=self.db, user=self.client_user)
        self.assertEqual(error.exception.status_code, 403)

    def test_project_leadership_accepts_an_enabled_admin_or_write_pm_account(self) -> None:
        with self.assertRaises(HTTPException) as error:
            update_project_manager(
                self.project_one.id,
                ProjectManagerInput(project_manager_id=self.dev.id),
                db=self.db,
                _owner=self.admin,
            )
        self.assertEqual(error.exception.status_code, 422)

        updated = update_project_manager(
            self.project_one.id,
            ProjectManagerInput(project_manager_id=self.other_pm.id),
            db=self.db,
            _owner=self.admin,
        )
        self.assertEqual(updated["project_manager_id"], self.other_pm.id)

        updated = update_project_manager(
            self.project_one.id,
            ProjectManagerInput(project_manager_id=self.owner_member.id),
            db=self.db,
            _owner=self.admin,
        )
        self.assertEqual(updated["project_manager_id"], self.owner_member.id)

    def test_pm_permission_cannot_be_read_only_or_removed_during_active_leadership(self) -> None:
        self.admin.is_primary_admin = 1
        with self.assertRaises(HTTPException) as error:
            provision_credentials(
                self.pm.id,
                EmployeeCredentialsInput(
                    email="pm@example.com",
                    account_role="pm",
                    access_level="read",
                    is_enabled=True,
                ),
                db=self.db,
                admin=self.admin,
            )
        self.assertEqual(error.exception.status_code, 422)

        with self.assertRaises(HTTPException) as error:
            provision_credentials(
                self.pm.id,
                EmployeeCredentialsInput(
                    email="pm@example.com",
                    account_role="developer",
                    access_level="write",
                    is_enabled=True,
                ),
                db=self.db,
                admin=self.admin,
            )
        self.assertEqual(error.exception.status_code, 409)

    def test_non_owner_admin_cannot_modify_a_privileged_account(self) -> None:
        with self.assertRaises(HTTPException) as error:
            provision_credentials(
                self.pm.id,
                EmployeeCredentialsInput(
                    email="pm@example.com",
                    account_role="pm",
                    access_level="write",
                    is_enabled=True,
                ),
                db=self.db,
                admin=self.admin,
            )
        self.assertEqual(error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
