from __future__ import annotations

import os
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from zipfile import ZIP_DEFLATED, ZipFile

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

_shared_test_database = Path(tempfile.gettempdir()) / "trackerx_unit_tests.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_shared_test_database.as_posix()}")

from app.db import Base
from app.models import Asset, AssetConnection, Milestone, Project, Task, TeamMember, User
from app.services.asset_excel_import import import_asset_excel
from app.services.asset_inventory_excel import build_asset_inventory_excel
from app.services.kanban_excel import build_kanban_excel
from app.services.kanban_excel_import import import_kanban_excel
from app.services.ooxml_workbook import WorkbookFormatError, read_xlsx


class ExcelTransferTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(
            email="owner@excel.test",
            hashed_password="x",
            full_name="Owner",
            role="admin",
            access_level="write",
            is_enabled=1,
        )
        self.member = TeamMember(
            employee_number="0002",
            name="Yazan Abu Osbeh",
            role="Project Manager",
            is_active=1,
        )
        self.project = Project(name="Excel Project", project_type="actual_project", status="active")
        self.db.add_all([self.user, self.member, self.project])
        self.db.flush()
        self.project.assigned_members.append(self.member)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_kanban_excel_preview_and_commit_create_complete_records(self) -> None:
        workbook = build_kanban_excel(
            project_id=self.project.id,
            project_name=self.project.name,
            exported_by=self.user.full_name,
            milestones=[{
                "id": None,
                "title": "Delivery phase",
                "description": "Requirements and implementation",
                "start_date": "2026-09-15",
                "end_date": "2026-09-30",
                "sort_order": 0,
                "total_tasks": 1,
                "done_tasks": 0,
                "progress_pct": 0,
                "risk_level": "unknown",
                "created_at": None,
                "updated_at": None,
            }],
            tasks=[{
                "id": None,
                "milestone_id": None,
                "title": "Deploy release",
                "description": "Run the verified deployment",
                "status": "in_progress",
                "assigned_members": [{"id": self.member.id, "employee_number": "0002", "name": self.member.name}],
                "start_date": "2026-09-20",
                "end_date": "2026-09-22",
                "est_days": 2,
                "is_delayed": False,
                "delay_cause": None,
                "delay_comment": None,
                "sort_order": 0,
                "risk_level": "on_track",
                "created_at": None,
                "updated_at": None,
            }],
        )
        preview = import_kanban_excel(
            self.db, project=self.project, user=self.user, raw=workbook, commit=False
        )
        self.assertTrue(preview["valid"], preview["errors"])
        self.assertEqual(preview["counts"]["milestones_create"], 1)
        self.assertEqual(preview["counts"]["tasks_create"], 1)
        self.assertEqual(self.db.query(Task).count(), 0)

        result = import_kanban_excel(
            self.db, project=self.project, user=self.user, raw=workbook, commit=True
        )
        self.assertTrue(result["committed"])
        task = self.db.query(Task).one()
        self.assertEqual(task.title, "Deploy release")
        self.assertEqual(task.status, "in_progress")
        self.assertEqual([item.employee_number for item in task.assigned_members], ["0002"])
        self.assertEqual(task.milestone.title, "Delivery phase")

    def test_exported_kanban_round_trip_updates_by_stable_ids(self) -> None:
        milestone = Milestone(project_id=self.project.id, title="Existing", sort_order=0)
        self.db.add(milestone)
        self.db.flush()
        task = Task(milestone_id=milestone.id, title="Existing task", status="todo", assigned_members=[self.member])
        self.db.add(task)
        self.db.commit()
        workbook = build_kanban_excel(
            project_id=self.project.id,
            project_name=self.project.name,
            exported_by=self.user.full_name,
            milestones=[{
                "id": milestone.id, "title": milestone.title, "description": None,
                "start_date": None, "end_date": None, "sort_order": 0,
                "total_tasks": 1, "done_tasks": 0, "progress_pct": 0,
                "risk_level": "unknown", "created_at": milestone.created_at, "updated_at": milestone.updated_at,
            }],
            tasks=[{
                "id": task.id, "milestone_id": milestone.id, "title": task.title,
                "description": None, "status": task.status,
                "assigned_members": [{"id": self.member.id, "employee_number": "0002", "name": self.member.name}],
                "start_date": None, "end_date": None, "est_days": None,
                "is_delayed": False, "delay_cause": None, "delay_comment": None,
                "sort_order": 0, "risk_level": "unknown",
                "created_at": task.created_at, "updated_at": task.updated_at,
            }],
        )
        preview = import_kanban_excel(
            self.db, project=self.project, user=self.user, raw=workbook, commit=False
        )
        self.assertTrue(preview["valid"], preview["errors"])
        self.assertEqual(preview["counts"]["milestones_update"], 1)
        self.assertEqual(preview["counts"]["tasks_update"], 1)

    def test_kanban_import_accepts_native_excel_date_values(self) -> None:
        start_serial = 46_300
        end_serial = 46_307
        workbook = build_kanban_excel(
            project_id=self.project.id,
            project_name=self.project.name,
            exported_by=self.user.full_name,
            milestones=[{
                "id": None, "title": "Excel-dated milestone", "description": None,
                "start_date": start_serial, "end_date": end_serial, "sort_order": 0,
                "total_tasks": 0, "done_tasks": 0, "progress_pct": 0,
                "risk_level": "unknown", "created_at": None, "updated_at": None,
            }],
            tasks=[],
        )
        result = import_kanban_excel(
            self.db, project=self.project, user=self.user, raw=workbook, commit=True
        )
        self.assertTrue(result["committed"], result["errors"])
        milestone = self.db.query(Milestone).one()
        self.assertEqual(
            milestone.start_date,
            (date(1899, 12, 30) + timedelta(days=start_serial)).isoformat(),
        )
        self.assertEqual(
            milestone.end_date,
            (date(1899, 12, 30) + timedelta(days=end_serial)).isoformat(),
        )

    def test_asset_excel_preview_and_commit_create_assets_ports_and_matrix_rule(self) -> None:
        assets = [
            {
                "id": None, "hostname": "app-01", "ip_address": "10.0.0.10",
                "environment": "production", "purpose": "API", "tier": "Application",
                "os": "Linux", "cpu": "4 vCPU", "ram": "8 GB", "storage": "100 GB",
                "applications": "TrackerX", "database": None, "services": "API",
                "status": "active", "notes": None, "created_by_name": None,
                "created_at": None, "updated_at": None, "ports": [],
            },
            {
                "id": None, "hostname": "db-01", "ip_address": "10.0.0.20",
                "environment": "production", "purpose": "Database", "tier": "Data",
                "os": "Linux", "cpu": "4 vCPU", "ram": "16 GB", "storage": "250 GB",
                "applications": None, "database": "PostgreSQL", "services": "Database",
                "status": "active", "notes": None, "created_by_name": None,
                "created_at": None, "updated_at": None,
                "ports": [{"id": None, "port": 5432, "protocol": "tcp", "service": "PostgreSQL", "notes": None, "created_at": None, "updated_at": None}],
            },
        ]
        workbook = build_asset_inventory_excel(
            project_id=self.project.id,
            project_name=self.project.name,
            project_type=self.project.project_type,
            assets=assets,
            connections=[{
                "id": None, "source_asset_id": None, "source_hostname": "app-01",
                "source_ip_address": "10.0.0.10", "destination_asset_id": None,
                "destination_hostname": "db-01", "destination_ip_address": "10.0.0.20",
                "port_id": None, "port": 5432, "protocol": "tcp", "service": "PostgreSQL",
                "status": "connected", "updated_at": None,
            }],
            exported_by=self.user.full_name,
        )
        preview = import_asset_excel(
            self.db, project=self.project, user=self.user, raw=workbook, commit=False
        )
        self.assertTrue(preview["valid"], preview["errors"])
        self.assertEqual(preview["counts"]["assets_create"], 2)
        self.assertEqual(preview["counts"]["ports_create"], 1)
        self.assertEqual(preview["counts"]["connections_create"], 1)

        result = import_asset_excel(
            self.db, project=self.project, user=self.user, raw=workbook, commit=True
        )
        self.assertTrue(result["committed"])
        self.assertEqual(self.db.query(Asset).count(), 2)
        self.assertEqual(self.db.query(AssetConnection).one().status, "connected")

    def test_import_rejects_macro_enabled_workbook_payload(self) -> None:
        clean_workbook = build_kanban_excel(
            project_id=self.project.id,
            project_name=self.project.name,
            exported_by=self.user.full_name,
            milestones=[],
            tasks=[],
        )
        malicious_workbook = BytesIO()
        with ZipFile(BytesIO(clean_workbook)) as source, ZipFile(
            malicious_workbook, "w", ZIP_DEFLATED
        ) as destination:
            for item in source.infolist():
                destination.writestr(item, source.read(item.filename))
            destination.writestr("xl/vbaProject.bin", b"not-a-real-macro")

        with self.assertRaisesRegex(WorkbookFormatError, "Macros"):
            read_xlsx(malicious_workbook.getvalue())


if __name__ == "__main__":
    unittest.main()
