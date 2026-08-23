from __future__ import annotations

import os
from pathlib import Path
import tempfile
import unittest


_database_file = Path(tempfile.gettempdir()) / "trackerx_leave_coverage_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_database_file.as_posix()}"

from app.db import Base, SessionLocal, engine
from app.deps import get_accessible_project_ids
from app.models import LeaveRequest, Milestone, Project, Task, TeamMember, User
from app.routers.coverage import (
    assign_leave_coverage,
    coverage_plan,
    my_coverage_offers,
    respond_to_coverage_offer,
)
from app.schemas.coverage import (
    CoverageAssignInput,
    CoverageAssignmentInput,
    CoverageResponseInput,
)
from app.routers.projects import update_project_manager
from app.schemas.project import ProjectManagerInput
from app.security import hash_password


class LeaveCoverageWorkflowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        Base.metadata.create_all(bind=engine)

    @classmethod
    def tearDownClass(cls) -> None:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        _database_file.unlink(missing_ok=True)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            admin = User(
                email="admin@trackerx.test",
                hashed_password=hash_password("AdminPassword123!"),
                full_name="TrackerX Admin",
                role="admin",
                access_level="write",
                is_enabled=1,
                is_primary_admin=1,
            )
            source_user = User(
                email="source@trackerx.test",
                hashed_password=hash_password("SourcePassword123!"),
                full_name="Source Employee",
                role="developer",
                access_level="write",
                is_enabled=1,
            )
            recipient_user = User(
                email="recipient@trackerx.test",
                hashed_password=hash_password("RecipientPassword123!"),
                full_name="Available Employee",
                role="developer",
                access_level="write",
                is_enabled=1,
            )
            db.add_all([admin, source_user, recipient_user])
            db.flush()

            source = TeamMember(
                name="Source Employee",
                role="Engineer",
                is_active=1,
                user_id=source_user.id,
            )
            recipient = TeamMember(
                name="Available Employee",
                role="Engineer",
                is_active=1,
                user_id=recipient_user.id,
            )
            db.add_all([source, recipient])
            db.flush()

            project = Project(name="Coverage Test Project", status="active")
            db.add(project)
            db.flush()
            milestone = Milestone(project_id=project.id, title="Delivery", sort_order=1)
            db.add(milestone)
            db.flush()
            task = Task(
                milestone_id=milestone.id,
                title="Production handover",
                status="in_progress",
                end_date="2026-08-25",
                est_days=3,
                assigned_member_id=source.id,
            )
            task.assigned_members = [source]
            leave = LeaveRequest(
                team_member_id=source.id,
                request_type="leave",
                start_date="2026-08-23",
                end_date="2026-08-23",
                duration_unit="days",
                reason="Planned leave",
            )
            db.add_all([task, leave])
            db.commit()

            self.admin_id = admin.id
            self.recipient_user_id = recipient_user.id
            self.source_id = source.id
            self.recipient_id = recipient.id
            self.task_id = task.id
            self.leave_id = leave.id
            self.project_id = project.id

    def test_offer_is_not_reassigned_until_recipient_accepts(self) -> None:
        with SessionLocal() as db:
            admin = db.get(User, self.admin_id)
            recipient_user = db.get(User, self.recipient_user_id)

            plan = coverage_plan(self.leave_id, db=db, _admin=admin)
            self.assertEqual(plan["tasks"][0]["requires_assignment"], True)

            assignment = assign_leave_coverage(
                self.leave_id,
                CoverageAssignInput(
                    assignments=[
                        CoverageAssignmentInput(
                            task_id=self.task_id,
                            to_member_id=self.recipient_id,
                        )
                    ],
                    coverage_note="Please cover this task during the approved leave.",
                    autofill_attendance=False,
                ),
                db=db,
                admin=admin,
            )
            self.assertEqual(assignment["leave_status"], "approved")
            offer_id = assignment["offers"][0]["id"]

            task = db.get(Task, self.task_id)
            self.assertEqual([member.id for member in task.assigned_members], [self.source_id])

            inbox = my_coverage_offers(status="pending", db=db, user=recipient_user)
            self.assertEqual(len(inbox), 1)

            response = respond_to_coverage_offer(
                offer_id,
                CoverageResponseInput(action="accepted"),
                db=db,
                user=recipient_user,
            )
            self.assertEqual(response["status"], "accepted")

            task = db.get(Task, self.task_id)
            self.assertEqual([member.id for member in task.assigned_members], [self.recipient_id])
            self.assertEqual(task.assigned_member_id, self.recipient_id)

    def test_owner_can_assign_any_active_employee_as_project_manager(self) -> None:
        with SessionLocal() as db:
            admin = db.get(User, self.admin_id)
            manager_user = db.get(User, self.recipient_user_id)
            result = update_project_manager(
                self.project_id,
                ProjectManagerInput(project_manager_id=self.recipient_id),
                db=db,
                _owner=admin,
            )

            self.assertEqual(result["project_manager_id"], self.recipient_id)
            self.assertEqual(result["project_manager_name"], "Available Employee")
            self.assertEqual(
                get_accessible_project_ids(manager_user, db),
                {self.project_id},
            )


if __name__ == "__main__":
    unittest.main()
