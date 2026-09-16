from __future__ import annotations

"""
routers/documents.py
Document upload/list/preview/download/update/delete. Bytes live in the configured
object store (MinIO/S3 or local disk); the DB stores metadata only.
- Upload / update / delete: admin or assigned staff with admin-approved write access.
- List / preview / download: any authenticated user with access to the project.
"""

import re
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import check_project_access, get_current_user, require_project_content_editor
from app.models import Document, Milestone, Project, User
from app.models.document import DOCUMENT_CATEGORIES
from app.schemas.document import DocumentOut, DocumentUpdate
from app.services.serialize import document_out
from app.services.document_storage import InvalidDocumentPath, build_storage_key
from app.services.object_store import (
    EmptyUpload,
    UploadTooLarge,
    consume_upload,
    get_document_store,
    object_key_from_stored,
    serve_download,
    serve_preview,
)

router = APIRouter(tags=["documents"])

_SAFE_NAME = re.compile(r"[^\w.\-]")


def _document_or_404(db: Session, document_id: int) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.get("/projects/{project_id}/documents", response_model=list[DocumentOut])
def list_documents(
    project_id: int,
    category: str | None = None,
    milestone_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    q = db.query(Document).filter(Document.project_id == project_id)
    if category:
        q = q.filter(Document.category == category)
    if milestone_id is not None:
        q = q.filter(Document.milestone_id == milestone_id)
    rows = q.order_by(Document.created_at.desc()).all()
    return [document_out(d) for d in rows]


@router.post("/projects/{project_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    project_id: int,
    category: str = Form(...),
    title: str = Form(...),
    milestone_id: int | None = Form(None),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    check_project_access(db, user, project_id)
    if category not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Invalid category '{category}'.")
    title = title.strip()
    if not title or len(title) > 300:
        raise HTTPException(status_code=422, detail="Document title must contain 1 to 300 characters.")
    if description is not None and len(description) > 10_000:
        raise HTTPException(status_code=422, detail="Document description exceeds 10,000 characters.")
    if len(file.filename or "file") > 255:
        raise HTTPException(status_code=422, detail="File name exceeds 255 characters.")
    if project.project_type == "maintenance_support" and milestone_id is not None:
        raise HTTPException(
            status_code=422,
            detail="Maintenance & Support documents are filed by category, without a milestone.",
        )
    if milestone_id is not None:
        ms = db.get(Milestone, milestone_id)
        if ms is None or ms.project_id != project_id:
            raise HTTPException(status_code=422, detail="Milestone does not belong to project.")

    parts = [str(project_id)]
    if milestone_id is not None:
        parts.append(str(milestone_id))
    parts.append(category)
    safe_name = _SAFE_NAME.sub("_", file.filename or "file")
    storage_key = build_storage_key(*parts, f"{uuid.uuid4().hex}_{safe_name}")
    store = get_document_store()
    try:
        payload, total_bytes = await consume_upload(file, settings.max_upload_bytes)
        try:
            store.put_fileobj(
                storage_key,
                payload,
                content_type=file.content_type,
                size=total_bytes,
            )
        finally:
            payload.close()
    except UploadTooLarge:
        raise HTTPException(status_code=413, detail="File exceeds the 50 MB limit.")
    except EmptyUpload:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")
    except Exception:
        store.delete(storage_key)
        raise

    doc = Document(
        project_id=project_id,
        milestone_id=milestone_id,
        category=category,
        title=title,
        description=description,
        file_name=file.filename or safe_name,
        file_path=storage_key,
        content_type=file.content_type,
        file_size=total_bytes,
        uploaded_by_id=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return document_out(doc)


@router.get("/documents/{document_id}/download")
def download_document(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Stream the file as an attachment (download, never inline preview)."""
    doc = _document_or_404(db, document_id)
    check_project_access(db, user, doc.project_id)
    return serve_download(doc.file_path, doc.file_name, doc.content_type)


@router.get("/documents/{document_id}/preview")
def preview_document(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Return an authorized inline preview without exposing the storage path."""
    doc = _document_or_404(db, document_id)
    check_project_access(db, user, doc.project_id)
    return serve_preview(doc.file_path, doc.file_name, doc.content_type)


@router.put("/documents/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: int,
    inp: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    doc = _document_or_404(db, document_id)
    check_project_access(db, user, doc.project_id)
    data = inp.model_dump(exclude_unset=True)
    if "category" in data and data["category"] not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid category.")
    for field, value in data.items():
        setattr(doc, field, value)
    db.commit()
    db.refresh(doc)
    return document_out(doc)


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_content_editor),
):
    doc = _document_or_404(db, document_id)
    check_project_access(db, user, doc.project_id)
    try:
        get_document_store().delete(object_key_from_stored(doc.file_path))
    except InvalidDocumentPath:
        pass
    db.delete(doc)
    db.commit()
