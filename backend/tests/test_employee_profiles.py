from __future__ import annotations

import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

_shared_test_database = Path(tempfile.gettempdir()) / "trackerx_unit_tests.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_shared_test_database.as_posix()}")

from fastapi import HTTPException

from app.models import EmployeeProfileFile, TeamMember
from app.routers.employee_profile_files import _require_file_view
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
        self.assertEqual(output["profile_file_count"], 1)

    def test_private_files_are_limited_to_admin_or_the_employee(self):
        member = SimpleNamespace(user_id=7)
        _require_file_view(SimpleNamespace(role="admin", id=1), member)
        _require_file_view(SimpleNamespace(role="developer", id=7), member)
        with self.assertRaises(HTTPException) as error:
            _require_file_view(SimpleNamespace(role="pm", id=12), member)
        self.assertEqual(error.exception.status_code, 403)
