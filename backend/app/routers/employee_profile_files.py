from __future__ import annotations

"""Private, backed-up files attached to employee profiles."""

from pathlib import Path
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import EmployeeProfileFile, TeamMember, User
from app.schemas.employee_profile_file import EmployeeProfileFileOut
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


def _require_file_manage(user: User, member: TeamMember) -> None:
    """Allow administrators, or an employee acting on their own private profile."""
    if user.role != "admin" and member.user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Employee files can be changed only by the employee or an administrator.",
        )


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
    user: User = Depends(get_current_user),
):
    member = _member_or_404(db, member_id)
    _require_file_manage(user, member)
    if not files:
        raise HTTPException(status_code=422, detail="Select at least one file.")
    if len(files) > _MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=422,
            detail=f"Upload no more than {_MAX_FILES_PER_UPLOAD} files at once.",
        )

    for upload in files:
        if len(upload.filename or "profile-file") > 255:
            raise HTTPException(status_code=422, detail="File name exceeds 255 characters.")
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix not in _ALLOWED_SUFFIXES:
            raise HTTPException(
                status_code=415,
                detail=f"{upload.filename or 'File'} is not a supported CV or profile file.",
            )

    store = get_document_store()
    stored_keys: list[str] = []
    records: list[EmployeeProfileFile] = []
    try:
        for upload in files:
            original_name = upload.filename or "profile-file"
            safe_name = _SAFE_NAME.sub("_", original_name)
            storage_key = build_storage_key(
                "_employee_profiles",
                str(member_id),
                f"{uuid.uuid4().hex}_{safe_name}",
            )
            try:
                payload, total_bytes = await consume_upload(upload, settings.max_upload_bytes)
            except UploadTooLarge:
                raise HTTPException(
                    status_code=413,
                    detail=f"{original_name} exceeds the 50 MB limit.",
                )
            except EmptyUpload:
                raise HTTPException(status_code=422, detail=f"{original_name} is empty.")
            try:
                store.put_fileobj(
                    storage_key,
                    payload,
                    content_type=upload.content_type,
                    size=total_bytes,
                )
            finally:
                payload.close()
            stored_keys.append(storage_key)
            record = EmployeeProfileFile(
                team_member_id=member_id,
                file_name=original_name,
                file_path=storage_key,
                content_type=upload.content_type,
                file_size=total_bytes,
                uploaded_by_id=user.id,
            )
            db.add(record)
            records.append(record)
        db.commit()
    except Exception:
        db.rollback()
        for storage_key in stored_keys:
            store.delete(storage_key)
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
    return serve_download(profile_file.file_path, profile_file.file_name, profile_file.content_type)


@router.get("/employee-profile-files/{file_id}/preview")
def preview_profile_file(
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile_file = _file_or_404(db, file_id)
    _require_file_view(user, profile_file.team_member)
    return serve_preview(profile_file.file_path, profile_file.file_name, profile_file.content_type)


@router.delete("/employee-profile-files/{file_id}", status_code=204)
def delete_profile_file(
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile_file = _file_or_404(db, file_id)
    _require_file_manage(user, profile_file.team_member)
    try:
        get_document_store().delete(object_key_from_stored(profile_file.file_path))
    except InvalidDocumentPath:
        pass
    db.delete(profile_file)
    db.commit()
