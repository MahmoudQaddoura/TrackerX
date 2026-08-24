from __future__ import annotations

import sqlite3
import tempfile
import unittest
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

            with closing(sqlite3.connect(database)) as connection:
                connection.execute(
                    "CREATE TABLE documents (id INTEGER PRIMARY KEY, file_name TEXT, "
                    "file_path TEXT, file_size INTEGER)"
                )
                connection.execute(
                    "INSERT INTO documents VALUES (1, ?, ?, ?)",
                    ("proposal.pdf", "5/technical/proposal.pdf", uploaded.stat().st_size),
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
            self.assertEqual(result["document_files"], 1)
            self.assertEqual(result["document_records"], 1)
            self.assertTrue(verified["verified"])
