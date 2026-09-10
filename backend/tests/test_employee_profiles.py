from __future__ import annotations

import asyncio
from io import BytesIO
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

_shared_test_database = Path(tempfile.gettempdir()) / "trackerx_unit_tests.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_shared_test_database.as_posix()}")

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.models import EmployeeProfileFile, TeamMember, User
from app.routers.employee_profile_files import (
    _require_file_manage,
    _require_file_view,
    delete_profile_file,
    list_profile_files,
    upload_profile_files,
)
from app.services.object_store import LocalDocumentStore
from app.services.serialize import team_member_out


class EmployeeProfileTests(unittest.TestCase):
    def test_profile_contains_bilingual_role_information_and_file_count(self):
        member = TeamMember(
            id=8,
            employee_number="0042",
            name="Employee Name",
            name_arabic="اسم الموظف",
            role="Engineer",
            role_description="Owns platform delivery and documentation.",
            employment_type="part_time",
            weekly_hours=24,
            is_active=1,
            created_at="2026-08-31T10:00:00",
            updated_at="2026-08-31T10:00:00",
        )
        member.profile_files.append(
            EmployeeProfileFile(
                file_name="resume.pdf",
                file_path="_employee_profiles/8/resume.pdf",
                file_size=12,
            )
        )

        output = team_member_out(member)

        self.assertEqual(output["employee_number"], "0042")
        self.assertEqual(output["name_arabic"], "اسم الموظف")
        self.assertEqual(output["role_description"], "Owns platform delivery and documentation.")
        self.assertEqual(output["employment_type"], "part_time")
        self.assertEqual(output["weekly_hours"], 24)
        self.assertEqual(output["profile_file_count"], 1)

    def test_private_files_are_limited_to_admin_or_the_employee(self):
        member = SimpleNamespace(user_id=7)
        _require_file_view(SimpleNamespace(role="admin", id=1), member)
        _require_file_view(SimpleNamespace(role="developer", id=7), member)
        with self.assertRaises(HTTPException) as error:
            _require_file_view(SimpleNamespace(role="pm", id=12), member)
        self.assertEqual(error.exception.status_code, 403)

    def test_profile_files_can_be_managed_by_admin_or_the_employee(self):
        member = SimpleNamespace(user_id=7)
        _require_file_manage(SimpleNamespace(role="admin", id=1), member)
        _require_file_manage(SimpleNamespace(role="developer", id=7), member)
        with self.assertRaises(HTTPException) as error:
            _require_file_manage(SimpleNamespace(role="pm", id=12), member)
        self.assertEqual(error.exception.status_code, 403)


class EmployeeProfileFileApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(
            email="employee@profile.test",
            hashed_password="x",
            full_name="Employee",
            role="developer",
            access_level="read",
            is_enabled=1,
        )
        self.other_user = User(
            email="other@profile.test",
            hashed_password="x",
            full_name="Other employee",
            role="developer",
            access_level="read",
            is_enabled=1,
        )
        self.db.add_all([self.user, self.other_user])
        self.db.flush()
        self.member = TeamMember(
            employee_number="0042",
            name="Employee",
            role="Engineer",
            user_id=self.user.id,
            is_active=1,
        )
        self.db.add(self.member)
        self.db.commit()
        self.storage_directory = tempfile.TemporaryDirectory()
        self.store = LocalDocumentStore(Path(self.storage_directory.name))

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.storage_directory.cleanup()

    def test_employee_can_upload_list_and_delete_own_cv(self) -> None:
        upload = UploadFile(filename="employee-cv.pdf", file=BytesIO(b"%PDF profile"))
        with patch(
            "app.routers.employee_profile_files.get_document_store",
            return_value=self.store,
        ):
            created = asyncio.run(
                upload_profile_files(
                    self.member.id,
                    [upload],
                    db=self.db,
                    user=self.user,
                )
            )
            listed = list_profile_files(self.member.id, db=self.db, user=self.user)
            self.assertEqual([item["file_name"] for item in listed], ["employee-cv.pdf"])
            record = self.db.get(EmployeeProfileFile, created[0]["id"])
            self.assertIsNotNone(record)
            self.assertTrue(self.store.exists(record.file_path))
            delete_profile_file(created[0]["id"], db=self.db, user=self.user)
            self.assertIsNone(self.db.get(EmployeeProfileFile, created[0]["id"]))

    def test_employee_cannot_upload_to_another_profile(self) -> None:
        upload = UploadFile(filename="not-mine.pdf", file=BytesIO(b"%PDF profile"))
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                upload_profile_files(
                    self.member.id,
                    [upload],
                    db=self.db,
                    user=self.other_user,
                )
            )
        self.assertEqual(error.exception.status_code, 403)
