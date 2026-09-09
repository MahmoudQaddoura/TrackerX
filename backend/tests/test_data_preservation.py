from __future__ import annotations

import sqlite3
import tempfile
import unittest
import zipfile
from contextlib import closing
from pathlib import Path


class DocumentStorageTests(unittest.TestCase):
    def test_legacy_windows_path_becomes_portable(self):
        from app.services.document_storage import resolve_document_path, storage_key_for_path

        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name) / "documents"
            expected = root / "5" / "technical" / "proposal.pdf"
            expected.parent.mkdir(parents=True)
            expected.touch()

            restored = resolve_document_path(
                r"C:\old-server\trackerx\backend\data\documents\5\technical\proposal.pdf",
                root,
            )

            self.assertEqual(restored, expected.resolve())
            self.assertEqual(storage_key_for_path(restored, root), "5/technical/proposal.pdf")

    def test_path_traversal_is_rejected(self):
        from app.services.document_storage import InvalidDocumentPath, resolve_document_path

        with tempfile.TemporaryDirectory() as temp_name:
            with self.assertRaises(InvalidDocumentPath):
                resolve_document_path("../outside.txt", Path(temp_name) / "documents")

    def test_object_keys_reject_traversal_and_backslashes(self):
        from app.services.document_storage import InvalidDocumentPath, build_storage_key
        from app.services.object_store import assert_object_key

        self.assertEqual(
            build_storage_key("5", "technical", "report.pdf"),
            "5/technical/report.pdf",
        )
        for unsafe in ("../report.pdf", "folder\\report.pdf", "/absolute.pdf", "a//b"):
            with self.subTest(unsafe=unsafe), self.assertRaises(InvalidDocumentPath):
                assert_object_key(unsafe)

    def test_local_object_store_round_trip(self):
        from io import BytesIO

        from app.services.object_store import LocalDocumentStore

        with tempfile.TemporaryDirectory() as temp_name:
            store = LocalDocumentStore(Path(temp_name))
            store.ensure_ready()
            store.put_fileobj(
                "project/report.txt",
                BytesIO(b"trackerx"),
                content_type="text/plain",
                size=8,
            )
            self.assertTrue(store.exists("project/report.txt"))
            self.assertEqual(store.object_size("project/report.txt"), 8)
            self.assertEqual(store.get_bytes("project/report.txt"), b"trackerx")
            self.assertEqual(store.list_keys(), ["project/report.txt"])
            store.delete("project/report.txt")
            self.assertFalse(store.exists("project/report.txt"))


class DataBackupTests(unittest.TestCase):
    def test_backup_contains_database_and_linked_uploads(self):
        from app.services.data_backup import create_data_backup, verify_data_backup

        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            database = root / "app.db"
            documents = root / "documents"
            uploaded = documents / "5" / "technical" / "proposal.pdf"
            uploaded.parent.mkdir(parents=True)
            uploaded.write_bytes(b"verifyx")
            cv_file = documents / "_employee_profiles" / "2" / "resume.pdf"
            cv_file.parent.mkdir(parents=True)
            cv_file.write_bytes(b"employee-profile")

            with closing(sqlite3.connect(database)) as connection:
                connection.execute(
                    "CREATE TABLE documents (id INTEGER PRIMARY KEY, file_name TEXT, "
                    "file_path TEXT, file_size INTEGER)"
                )
                connection.execute(
                    "INSERT INTO documents VALUES (1, ?, ?, ?)",
                    ("proposal.pdf", "5/technical/proposal.pdf", uploaded.stat().st_size),
                )
                connection.execute(
                    "CREATE TABLE employee_profile_files (id INTEGER PRIMARY KEY, "
                    "team_member_id INTEGER, file_name TEXT, file_path TEXT, file_size INTEGER)"
                )
                connection.execute(
                    "INSERT INTO employee_profile_files VALUES (1, 2, ?, ?, ?)",
                    ("resume.pdf", "_employee_profiles/2/resume.pdf", cv_file.stat().st_size),
                )
                connection.commit()

            result = create_data_backup(
                database=database,
                documents_root=documents,
                output_dir=root / "backups",
                reason="test",
                keep=2,
            )
            verified = verify_data_backup(Path(result["archive"]))

            self.assertTrue(result["verified"])
            self.assertEqual(result["document_files"], 2)
            self.assertEqual(result["document_records"], 1)
            self.assertEqual(result["employee_profile_file_records"], 1)
            self.assertTrue(verified["verified"])
            with zipfile.ZipFile(result["archive"], "r") as archive:
                self.assertIn(
                    "documents/_employee_profiles/2/resume.pdf",
                    archive.namelist(),
                )
