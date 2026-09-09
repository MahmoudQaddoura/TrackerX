from __future__ import annotations

"""Verified backups containing the SQLite database and every uploaded file."""

import hashlib
import json
import re
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.services.document_storage import InvalidDocumentPath, storage_key_from_value


BACKUP_FORMAT_VERSION = 1
_SAFE_REASON = re.compile(r"[^a-z0-9_-]+")


class DataBackupError(RuntimeError):
    pass


def sqlite_database_path(database_url: str | None = None) -> Path:
    url = database_url or settings.database_url
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        raise DataBackupError("The built-in backup tool currently supports SQLite only.")
    value = url[len(prefix) :]
    if not value or value == ":memory:":
        raise DataBackupError("A file-backed SQLite database is required for backups.")
    return Path(value).expanduser().resolve()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _snapshot_database(source: Path, destination: Path) -> None:
    with closing(sqlite3.connect(str(source), timeout=30)) as source_db:
        with closing(sqlite3.connect(str(destination))) as destination_db:
            source_db.backup(destination_db)
            destination_db.commit()
    with closing(sqlite3.connect(str(destination))) as snapshot:
        result = snapshot.execute("PRAGMA integrity_check").fetchone()
    if result is None or result[0] != "ok":
        raise DataBackupError(f"SQLite integrity check failed: {result}")


def _document_records(database: Path, documents_root: Path) -> list[dict[str, object]]:
    with closing(sqlite3.connect(str(database))) as connection:
        table_exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'documents'"
        ).fetchone()
        if table_exists is None:
            return []
        records = connection.execute(
            "SELECT id, file_name, file_path, file_size FROM documents ORDER BY id"
        ).fetchall()

    normalized: list[dict[str, object]] = []
    for document_id, file_name, stored_path, file_size in records:
        try:
            storage_key = storage_key_from_value(stored_path, documents_root)
        except InvalidDocumentPath as exc:
            raise DataBackupError(
                f"Document {document_id} has an unsafe storage path and cannot be backed up."
            ) from exc
        normalized.append(
            {
                "id": document_id,
                "file_name": file_name,
                "storage_key": storage_key,
                "file_size": file_size,
            }
        )
    return normalized


def _employee_profile_file_records(
    database: Path, documents_root: Path
) -> list[dict[str, object]]:
    """Collect private employee-file links for the same verified file manifest."""

    with closing(sqlite3.connect(str(database))) as connection:
        table_exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' "
            "AND name = 'employee_profile_files'"
        ).fetchone()
        if table_exists is None:
            return []
        records = connection.execute(
            "SELECT id, team_member_id, file_name, file_path, file_size "
            "FROM employee_profile_files ORDER BY id"
        ).fetchall()

    normalized: list[dict[str, object]] = []
    for file_id, member_id, file_name, stored_path, file_size in records:
        try:
            storage_key = storage_key_from_value(stored_path, documents_root)
        except InvalidDocumentPath as exc:
            raise DataBackupError(
                f"Employee profile file {file_id} has an unsafe storage path."
            ) from exc
        normalized.append(
            {
                "id": file_id,
                "team_member_id": member_id,
                "file_name": file_name,
                "storage_key": storage_key,
                "file_size": file_size,
            }
        )
    return normalized


def _remove_expired_backups(output_dir: Path, keep: int) -> None:
    if keep <= 0:
        return
    archives = sorted(
        output_dir.glob("trackerx-data-*.zip"), key=lambda path: path.stat().st_mtime, reverse=True
    )
    for archive in archives[keep:]:
        archive.unlink(missing_ok=True)


def create_data_backup(
    *,
    database: Path | None = None,
    documents_root: Path | None = None,
    output_dir: Path | None = None,
    reason: str = "manual",
    keep: int | None = None,
) -> dict[str, object]:
    """Create and verify one portable TrackerX data archive."""

    database = (database or sqlite_database_path()).resolve()
    output_dir = (output_dir or settings.backup_dir).resolve()
    retention = settings.backup_retention_count if keep is None else keep
    use_object_store = documents_root is None and settings.uses_s3_storage
    documents_root = (documents_root or settings.documents_dir).resolve()

    if not database.is_file():
        raise FileNotFoundError(f"TrackerX database not found: {database}")
    output_dir.mkdir(parents=True, exist_ok=True)
    if not use_object_store:
        documents_root.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_reason = _SAFE_REASON.sub("-", reason.strip().lower()).strip("-") or "manual"
    destination = output_dir / f"trackerx-data-{timestamp}-{safe_reason}.zip"
    if destination.exists():
        destination = output_dir / f"trackerx-data-{timestamp}-{safe_reason}-2.zip"
    partial = destination.with_suffix(".zip.partial")

    with tempfile.TemporaryDirectory(prefix="trackerx-backup-", dir=output_dir) as temp_name:
        snapshot = Path(temp_name) / "app.db"
        _snapshot_database(database, snapshot)
        records = _document_records(snapshot, documents_root)
        profile_records = _employee_profile_file_records(snapshot, documents_root)
        linked_records = [*records, *profile_records]
        store = None
        local_files: dict[str, Path] = {}
        if use_object_store:
            from app.services.object_store import get_document_store

            store = get_document_store()
            payload_sizes = {key: store.object_size(key) for key in store.list_keys()}
        else:
            disk_files = sorted(path for path in documents_root.rglob("*") if path.is_file())
            for path in disk_files:
                local_files[path.relative_to(documents_root).as_posix()] = path
            payload_sizes = {key: path.stat().st_size for key, path in local_files.items()}
        missing = [record for record in linked_records if record["storage_key"] not in payload_sizes]
        if missing:
            missing_files = ", ".join(str(record["file_name"]) for record in missing)
            raise DataBackupError(f"Database-linked uploaded files are missing: {missing_files}")
        size_mismatches = [
            record
            for record in linked_records
            if record["file_size"] is not None
            and int(record["file_size"]) != payload_sizes[str(record["storage_key"])]
        ]
        if size_mismatches:
            mismatch_files = ", ".join(str(record["file_name"]) for record in size_mismatches)
            raise DataBackupError(f"File-size verification failed for: {mismatch_files}")

        manifest = {
            "format_version": BACKUP_FORMAT_VERSION,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "reason": safe_reason,
            "database": {
                "path": "database/app.db",
                "size": snapshot.stat().st_size,
                "sha256": _sha256(snapshot),
                "integrity_check": "ok",
            },
            "document_records": records,
            "employee_profile_file_records": profile_records,
            "files": [],
        }

        try:
            with zipfile.ZipFile(partial, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.write(snapshot, "database/app.db")
                files_manifest: list[dict[str, object]] = []
                for key, size in payload_sizes.items():
                    if store is not None:
                        data = store.get_bytes(key)
                        archive.writestr(f"documents/{key}", data)
                        digest = hashlib.sha256(data).hexdigest()
                    else:
                        path = local_files[key]
                        archive.write(path, f"documents/{key}")
                        digest = _sha256(path)
                    files_manifest.append(
                        {
                            "path": f"documents/{key}",
                            "size": size,
                            "sha256": digest,
                        }
                    )
                manifest["files"] = files_manifest
                archive.writestr("manifest.json", json.dumps(manifest, indent=2, sort_keys=True))
            partial.replace(destination)
        finally:
            partial.unlink(missing_ok=True)

    verification = verify_data_backup(destination)
    _remove_expired_backups(output_dir, retention)
    return {
        "archive": str(destination),
        "database_bytes": verification["database_bytes"],
        "document_files": verification["document_files"],
        "document_records": len(verification["manifest"]["document_records"]),
        "employee_profile_file_records": len(
            verification["manifest"].get("employee_profile_file_records", [])
        ),
        "verified": True,
    }


def verify_data_backup(archive_path: Path) -> dict[str, object]:
    """Verify checksums, SQLite integrity, and document metadata coverage."""

    archive_path = archive_path.resolve()
    with zipfile.ZipFile(archive_path, "r") as archive:
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("format_version") != BACKUP_FORMAT_VERSION:
            raise DataBackupError("Unsupported TrackerX backup format.")

        expected_entries = [manifest["database"], *manifest["files"]]
        names = set(archive.namelist())
        for entry in expected_entries:
            path = entry["path"]
            if path not in names:
                raise DataBackupError(f"Backup entry is missing: {path}")
            digest = hashlib.sha256(archive.read(path)).hexdigest()
            if digest != entry["sha256"]:
                raise DataBackupError(f"Checksum mismatch for backup entry: {path}")

        archived_documents = {
            entry["path"].removeprefix("documents/"): entry for entry in manifest["files"]
        }
        linked_records = [
            *manifest["document_records"],
            *manifest.get("employee_profile_file_records", []),
        ]
        missing_records = [
            record
            for record in linked_records
            if record["storage_key"] not in archived_documents
        ]
        if missing_records:
            raise DataBackupError("The archive does not contain every database-linked document.")
        size_mismatches = [
            record
            for record in linked_records
            if record["file_size"] is not None
            and int(record["file_size"])
            != archived_documents[record["storage_key"]]["size"]
        ]
        if size_mismatches:
            raise DataBackupError("Archived document sizes do not match the database metadata.")

        with tempfile.TemporaryDirectory(prefix="trackerx-verify-") as temp_name:
            database_copy = Path(temp_name) / "app.db"
            database_copy.write_bytes(archive.read(manifest["database"]["path"]))
            with closing(sqlite3.connect(str(database_copy))) as connection:
                integrity = connection.execute("PRAGMA integrity_check").fetchone()
            if integrity is None or integrity[0] != "ok":
                raise DataBackupError(f"Archived SQLite integrity check failed: {integrity}")

    return {
        "archive": str(archive_path),
        "database_bytes": manifest["database"]["size"],
        "document_files": len(manifest["files"]),
        "manifest": manifest,
        "verified": True,
    }
