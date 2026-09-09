from __future__ import annotations

"""Portable, validated paths for uploaded TrackerX documents."""

from pathlib import Path, PurePosixPath, PureWindowsPath

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Document


class InvalidDocumentPath(ValueError):
    """Raised when a stored path can escape the configured document root."""


def _legacy_document_tail(value: str) -> tuple[str, ...] | None:
    """Return the part after a legacy ``documents`` directory, on any OS."""

    pure_path = PureWindowsPath(value) if "\\" in value else PurePosixPath(value)
    parts = pure_path.parts
    indexes = [index for index, part in enumerate(parts) if part.casefold() == "documents"]
    if not indexes:
        return None
    tail = parts[indexes[-1] + 1 :]
    return tuple(tail) if tail else None


def resolve_document_path(value: str | Path, root: Path | None = None) -> Path:
    """Resolve a portable or legacy stored path beneath the configured root."""

    base = (root or settings.documents_dir).resolve()
    raw = str(value).strip()
    if not raw:
        raise InvalidDocumentPath("The stored document path is empty.")

    native_path = Path(raw)
    windows_absolute = PureWindowsPath(raw).is_absolute()
    if native_path.is_absolute() and not windows_absolute:
        candidate = native_path.resolve()
    elif native_path.is_absolute() and native_path.exists():
        candidate = native_path.resolve()
    elif windows_absolute or native_path.is_absolute():
        tail = _legacy_document_tail(raw)
        if tail is None:
            raise InvalidDocumentPath("The absolute document path is outside document storage.")
        candidate = base.joinpath(*tail).resolve()
    else:
        candidate = base.joinpath(*PurePosixPath(raw.replace("\\", "/")).parts).resolve()

    try:
        candidate.relative_to(base)
    except ValueError:
        tail = _legacy_document_tail(raw)
        if tail is None:
            raise InvalidDocumentPath("The document path is outside document storage.")
        candidate = base.joinpath(*tail).resolve()
        try:
            candidate.relative_to(base)
        except ValueError as exc:
            raise InvalidDocumentPath("The document path is outside document storage.") from exc
    return candidate


def storage_key_for_path(path: Path, root: Path | None = None) -> str:
    """Convert a disk path into the portable value persisted in the database."""

    base = (root or settings.documents_dir).resolve()
    candidate = path.resolve()
    try:
        relative = candidate.relative_to(base)
    except ValueError as exc:
        raise InvalidDocumentPath("The document path is outside document storage.") from exc
    return relative.as_posix()


def storage_key_from_value(value: str | Path, root: Path | None = None) -> str:
    return storage_key_for_path(resolve_document_path(value, root), root)


def build_storage_key(*parts: str) -> str:
    """Build a portable posix object key from relative path segments."""

    if not parts:
        raise InvalidDocumentPath("The stored document path is empty.")
    cleaned: list[str] = []
    for part in parts:
        piece = str(part).strip().replace("\\", "/").strip("/")
        if not piece or piece in {".", ".."} or "/" in piece:
            raise InvalidDocumentPath("The document path is outside document storage.")
        cleaned.append(piece)
    return "/".join(cleaned)


def normalize_document_storage_paths(db: Session, root: Path | None = None) -> dict[str, int]:
    """Replace legacy absolute database paths with portable storage keys."""

    updated = 0
    invalid = 0
    for document in db.query(Document).all():
        try:
            key = storage_key_from_value(document.file_path, root)
        except InvalidDocumentPath:
            invalid += 1
            continue
        if document.file_path != key:
            document.file_path = key
            updated += 1
    if updated:
        db.commit()
    return {"updated": updated, "invalid": invalid}
