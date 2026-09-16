from __future__ import annotations

import asyncio
from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.models import Document, Milestone, Project, User
from app.routers.documents import download_document, list_documents, upload_document
from app.services.object_store import LocalDocumentStore


class SupportDocumentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.owner = User(
            email="owner@support-documents.test",
            hashed_password="x",
            full_name="Owner",
            role="admin",
            access_level="write",
            is_enabled=1,
        )
        self.project = Project(name="Maintenance workspace", project_type="maintenance_support")
        self.db.add_all([self.owner, self.project])
        self.db.commit()
        self.store = LocalDocumentStore(Path(self.temp.name) / "documents")

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.temp.cleanup()

    def test_support_file_uploads_and_downloads_without_milestone(self) -> None:
        content = b"TrackerX service evidence\n"
        upload = UploadFile(filename="service-evidence.txt", file=BytesIO(content))
        with patch("app.routers.documents.get_document_store", return_value=self.store):
            created = asyncio.run(
                upload_document(
                    self.project.id,
                    category="technical",
                    title="service-evidence.txt",
                    milestone_id=None,
                    description="[trackerx-document] collection=operations; folder=technical_manual;",
                    file=upload,
                    db=self.db,
                    user=self.owner,
                )
            )

        self.assertIsNone(created["milestone_id"])
        listed = list_documents(self.project.id, db=self.db, user=self.owner)
        self.assertEqual([item["id"] for item in listed], [created["id"]])

        with patch("app.services.object_store.get_document_store", return_value=self.store):
            response = download_document(created["id"], db=self.db, user=self.owner)
            self.assertTrue(response.headers["content-disposition"].startswith("attachment;"))
            self.assertEqual(Path(response.path).read_bytes(), content)

            stored = self.db.get(Document, created["id"])
            self.store.delete(stored.file_path)
            with self.assertRaises(HTTPException) as missing:
                download_document(created["id"], db=self.db, user=self.owner)
            self.assertEqual(missing.exception.status_code, 410)

    def test_support_upload_rejects_milestone_link(self) -> None:
        milestone = Milestone(project_id=self.project.id, title="Legacy stage")
        self.db.add(milestone)
        self.db.commit()

        with self.assertRaises(HTTPException) as rejected:
            asyncio.run(
                upload_document(
                    self.project.id,
                    category="technical",
                    title="service-evidence.txt",
                    milestone_id=milestone.id,
                    description="[trackerx-document] collection=operations; folder=technical_manual;",
                    file=UploadFile(filename="service-evidence.txt", file=BytesIO(b"data")),
                    db=self.db,
                    user=self.owner,
                )
            )
        self.assertEqual(rejected.exception.status_code, 422)
        self.assertEqual(self.db.query(Document).count(), 0)
