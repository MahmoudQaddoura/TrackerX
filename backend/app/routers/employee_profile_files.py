from __future__ import annotations

"""Private, backed-up files attached to employee profiles."""

from pathlib import Path
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import EmployeeProfileFile, TeamMember, User
from app.schemas.employee_profile_file import EmployeeProfileFileOut
from app.services.document_preview import PreviewUnavailable, prepare_preview
from app.services.document_storage import (
    InvalidDocumentPath,
    resolve_document_path,
    storage_key_for_path,
)

router = APIRouter(tags=["employee profiles"])

_SAFE_NAME = re.compile(r"[^\w.\-]")
_ALLOWED_SUFFIXES = {
    ".pdf", ".doc", ".docx", ".txt", ".md", ".rtf",
    ".png", ".jpg", ".jpeg", ".webp",
}
_MAX_FILES_PER_UPLOAD = 20


def _member_or_404(db: Session, member_id: int) -> TeamMember:
    member = db.get(TeamMember, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return member


def _file_or_404(db: Session, file_id: int) -> EmployeeProfileFile:
    profile_file = db.get(EmployeeProfileFile, file_id)
    if profile_file is None:
        raise HTTPException(status_code=404, detail="Employee file not found.")
    return profile_file


def _require_file_view(user: User, member: TeamMember) -> None:
    if user.role != "admin" and member.user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Employee files are private to the employee and administrators.",
        )


def _stored_path(profile_file: EmployeeProfileFile) -> Path:
    try:
        return resolve_document_path(profile_file.file_path)
    except InvalidDocumentPath:
        raise HTTPException(status_code=410, detail="The stored employee file path is invalid.")


def _file_out(profile_file: EmployeeProfileFile) -> dict:
    return {
        "id": profile_file.id,
        "team_member_id": profile_file.team_member_id,
        "file_name": profile_file.file_name,
        "content_type": profile_file.content_type,
        "file_size": profile_file.file_size,
        "uploaded_by_name": (
            profile_file.uploaded_by.full_name if profile_file.uploaded_by else None
        ),
        "created_at": profile_file.created_at,
    }


@router.get(
    "/team-members/{member_id}/profile-files",
    response_model=list[EmployeeProfileFileOut],
)
def list_profile_files(
    member_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    member = _member_or_404(db, member_id)
    _require_file_view(user, member)
    files = (
        db.query(EmployeeProfileFile)
        .filter(EmployeeProfileFile.team_member_id == member_id)
        .order_by(EmployeeProfileFile.created_at.desc(), EmployeeProfileFile.id.desc())
        .all()
    )
    return [_file_out(profile_file) for profile_file in files]


@router.post(
    "/team-members/{member_id}/profile-files",
    response_model=list[EmployeeProfileFileOut],
    status_code=201,
)
async def upload_profile_files(
    member_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    _member_or_404(db, member_id)
    if not files:
        raise HTTPException(status_code=422, detail="Select at least one file.")
    if len(files) > _MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=422,
            detail=f"Upload no more than {_MAX_FILES_PER_UPLOAD} files at once.",
        )

    for upload in files:
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix not in _ALLOWED_SUFFIXES:
            raise HTTPException(
                status_code=415,
                detail=f"{upload.filename or 'File'} is not a supported CV or profile file.",
            )

    folder = settings.documents_dir / "_employee_profiles" / str(member_id)
    folder.mkdir(parents=True, exist_ok=True)
    stored_paths: list[Path] = []
    records: list[EmployeeProfileFile] = []
    try:
        for upload in files:
            original_name = upload.filename or "profile-file"
            safe_name = _SAFE_NAME.sub("_", original_name)
            stored_path = folder / f"{uuid.uuid4().hex}_{safe_name}"
            stored_paths.append(stored_path)
            total_bytes = 0
            with stored_path.open("wb") as destination:
                while chunk := await upload.read(1024 * 1024):
                    total_bytes += len(chunk)
                    if total_bytes > settings.max_upload_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail=f"{original_name} exceeds the 50 MB limit.",
                        )
                    destination.write(chunk)
            if total_bytes == 0:
                raise HTTPException(status_code=422, detail=f"{original_name} is empty.")
            record = EmployeeProfileFile(
                team_member_id=member_id,
                file_name=original_name,
                file_path=storage_key_for_path(stored_path),
                content_type=upload.content_type,
                file_size=total_bytes,
                uploaded_by_id=admin.id,
            )
            db.add(record)
            records.append(record)
        db.commit()
    except Exception:
        db.rollback()
        for stored_path in stored_paths:
            stored_path.unlink(missing_ok=True)
        raise

    for record in records:
        db.refresh(record)
    return [_file_out(record) for record in records]


@router.get("/employee-profile-files/{file_id}/download")
def download_profile_file(
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile_file = _file_or_404(db, file_id)
    _require_file_view(user, profile_file.team_member)
    path = _stored_path(profile_file)
    if not path.exists():
        raise HTTPException(status_code=410, detail="File is no longer available on the server.")
    return FileResponse(
        path,
        filename=profile_file.file_name,
        media_type=profile_file.content_type or "application/octet-stream",
        content_disposition_type="attachment",
    )


@router.get("/employee-profile-files/{file_id}/preview")
def preview_profile_file(
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile_file = _file_or_404(db, file_id)
    _require_file_view(user, profile_file.team_member)
    path = _stored_path(profile_file)
    if not path.exists():
        raise HTTPException(status_code=410, detail="File is no longer available on the server.")
    try:
        preview = prepare_preview(path, profile_file.file_name, profile_file.content_type)
    except PreviewUnavailable as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    headers = {
        "Content-Disposition": "inline",
        "X-Preview-Truncated": "true" if preview.truncated else "false",
    }
    if preview.kind == "binary":
        return FileResponse(
            path,
            filename=profile_file.file_name,
            media_type=preview.media_type,
            content_disposition_type="inline",
            headers=headers,
        )
    return PlainTextResponse(preview.text or "", media_type=preview.media_type, headers=headers)


@router.delete("/employee-profile-files/{file_id}", status_code=204)
def delete_profile_file(
    file_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    profile_file = _file_or_404(db, file_id)
    _stored_path(profile_file).unlink(missing_ok=True)
    db.delete(profile_file)
    db.commit()
