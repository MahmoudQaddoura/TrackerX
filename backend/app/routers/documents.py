from __future__ import annotations

"""
routers/documents.py
Document upload/list/preview/download/update/delete. Files are written to disk under
settings.documents_dir; the DB stores metadata only.
- Upload / update / delete: admin or assigned staff with admin-approved write access.
- List / preview / download: any authenticated user with access to the project.
"""

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import check_project_access, get_current_user, require_project_content_editor
from app.models import Document, Milestone, Project, User
from app.models.document import DOCUMENT_CATEGORIES
from app.schemas.document import DocumentOut, DocumentUpdate
from app.services.serialize import document_out
from app.services.document_preview import PreviewUnavailable, prepare_preview
from app.services.document_storage import (
    InvalidDocumentPath,
    resolve_document_path,
    storage_key_for_path,
)

router = APIRouter(tags=["documents"])

_SAFE_NAME = re.compile(r"[^\w.\-]")


def _document_or_404(db: Session, document_id: int) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


def _stored_document_path(doc: Document) -> Path:
    try:
        return resolve_document_path(doc.file_path)
    except InvalidDocumentPath:
        raise HTTPException(status_code=410, detail="The stored file path is invalid.")


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
    if db.get(Project, project_id) is None:
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
    if milestone_id is not None:
        ms = db.get(Milestone, milestone_id)
        if ms is None or ms.project_id != project_id:
            raise HTTPException(status_code=422, detail="Milestone does not belong to project.")

    # Build a collision-proof path: documents/<project>/<milestone?>/<category>/<uuid>_<name>
    parts = [str(project_id)]
    if milestone_id is not None:
        parts.append(str(milestone_id))
    parts.append(category)
    folder = Path(settings.documents_dir).joinpath(*parts)
    folder.mkdir(parents=True, exist_ok=True)

    safe_name = _SAFE_NAME.sub("_", file.filename or "file")
    stored_path = folder / f"{uuid.uuid4().hex}_{safe_name}"
    total_bytes = 0
    try:
        with stored_path.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > settings.max_upload_bytes:
                    raise HTTPException(status_code=413, detail="File exceeds the 50 MB limit.")
                destination.write(chunk)
        if total_bytes == 0:
            raise HTTPException(status_code=422, detail="Uploaded file is empty.")
    except Exception:
        stored_path.unlink(missing_ok=True)
        raise

    doc = Document(
        project_id=project_id,
        milestone_id=milestone_id,
        category=category,
        title=title,
        description=description,
        file_name=file.filename or safe_name,
        file_path=storage_key_for_path(stored_path),
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
    path = _stored_document_path(doc)
    if not path.exists():
        raise HTTPException(status_code=410, detail="File is no longer available on the server.")
    return FileResponse(
        path,
        filename=doc.file_name,
        media_type=doc.content_type or "application/octet-stream",
        content_disposition_type="attachment",
    )


@router.get("/documents/{document_id}/preview")
def preview_document(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Return an authorized inline preview without exposing the storage path."""
    doc = _document_or_404(db, document_id)
    check_project_access(db, user, doc.project_id)
    path = _stored_document_path(doc)
    if not path.exists():
        raise HTTPException(status_code=410, detail="File is no longer available on the server.")
    try:
        preview = prepare_preview(path, doc.file_name, doc.content_type)
    except PreviewUnavailable as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    headers = {
        "Content-Disposition": "inline",
        "X-Preview-Truncated": "true" if preview.truncated else "false",
    }
    if preview.kind == "binary":
        return FileResponse(
            path,
            filename=doc.file_name,
            media_type=preview.media_type,
            content_disposition_type="inline",
            headers=headers,
        )
    return PlainTextResponse(preview.text or "", media_type=preview.media_type, headers=headers)


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
    _stored_document_path(doc).unlink(missing_ok=True)  # remove the file from disk
    db.delete(doc)
    db.commit()
