from __future__ import annotations

"""Local-disk or S3-compatible object storage for TrackerX uploads."""

from functools import lru_cache
from pathlib import Path
from tempfile import NamedTemporaryFile, SpooledTemporaryFile
from typing import BinaryIO, Iterator
from urllib.parse import quote

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from starlette.background import BackgroundTask
from starlette.responses import Response

from app.config import settings
from app.services.document_preview import PreviewUnavailable, prepare_preview
from app.services.document_storage import InvalidDocumentPath, storage_key_from_value


class UploadTooLarge(ValueError):
    pass


class EmptyUpload(ValueError):
    pass


class ObjectNotFound(FileNotFoundError):
    pass


def assert_object_key(key: str) -> str:
    if not key or key.startswith("/") or "\\" in key:
        raise InvalidDocumentPath("The document path is outside document storage.")
    parts = key.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise InvalidDocumentPath("The document path is outside document storage.")
    return key


def object_key_from_stored(value: str) -> str:
    return assert_object_key(storage_key_from_value(value))


def _disposition(disposition: str, filename: str) -> str:
    ascii_name = filename.encode("ascii", "ignore").decode("ascii").replace('"', "") or "file"
    return f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def _unlink(path: Path) -> None:
    path.unlink(missing_ok=True)


class LocalDocumentStore:
    backend_name = "local"

    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or settings.documents_dir).resolve()

    def ensure_ready(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = self.root.joinpath(*assert_object_key(key).split("/")).resolve()
        if not path.is_relative_to(self.root):
            raise InvalidDocumentPath("The document path is outside document storage.")
        return path

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def object_size(self, key: str) -> int:
        path = self._path(key)
        if not path.is_file():
            raise ObjectNotFound(key)
        return path.stat().st_size

    def put_fileobj(
        self, key: str, fileobj: BinaryIO, *, content_type: str | None, size: int
    ) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as destination:
            while chunk := fileobj.read(1024 * 1024):
                destination.write(chunk)

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def get_bytes(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise ObjectNotFound(key)
        return path.read_bytes()

    def list_keys(self) -> list[str]:
        if not self.root.exists():
            return []
        return sorted(
            path.relative_to(self.root).as_posix()
            for path in self.root.rglob("*")
            if path.is_file()
        )

    def materialize(self, key: str) -> tuple[Path, bool]:
        path = self._path(key)
        if not path.is_file():
            raise ObjectNotFound(key)
        return path, False

    def file_response(
        self, key: str, filename: str, media_type: str, disposition: str
    ) -> Response:
        path = self._path(key)
        if not path.is_file():
            raise ObjectNotFound(key)
        return FileResponse(
            path,
            filename=filename,
            media_type=media_type,
            content_disposition_type=disposition,
        )


class S3DocumentStore:
    backend_name = "s3"

    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        try:
            client_config = Config(
                s3={"addressing_style": "path"},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            )
        except TypeError:
            client_config = Config(s3={"addressing_style": "path"})
        self.bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=client_config,
        )

    def ensure_ready(self) -> None:
        from botocore.exceptions import ClientError

        try:
            self._client.head_bucket(Bucket=self.bucket)
        except ClientError as exc:
            if not self._missing(exc):
                raise
            self._client.create_bucket(Bucket=self.bucket)

    def _missing(self, exc: Exception) -> bool:
        code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        return code in {"404", "NoSuchKey", "NotFound", "NoSuchBucket"}

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self._client.head_object(Bucket=self.bucket, Key=assert_object_key(key))
            return True
        except ClientError as exc:
            if self._missing(exc):
                return False
            raise

    def object_size(self, key: str) -> int:
        from botocore.exceptions import ClientError

        try:
            response = self._client.head_object(Bucket=self.bucket, Key=assert_object_key(key))
        except ClientError as exc:
            if self._missing(exc):
                raise ObjectNotFound(key) from exc
            raise
        return int(response["ContentLength"])

    def put_fileobj(
        self, key: str, fileobj: BinaryIO, *, content_type: str | None, size: int
    ) -> None:
        extra: dict[str, str] = {}
        if content_type:
            extra["ContentType"] = content_type
        if extra:
            self._client.upload_fileobj(
                fileobj,
                self.bucket,
                assert_object_key(key),
                ExtraArgs=extra,
            )
        else:
            self._client.upload_fileobj(fileobj, self.bucket, assert_object_key(key))

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=assert_object_key(key))

    def get_bytes(self, key: str) -> bytes:
        from botocore.exceptions import ClientError

        try:
            response = self._client.get_object(Bucket=self.bucket, Key=assert_object_key(key))
        except ClientError as exc:
            if self._missing(exc):
                raise ObjectNotFound(key) from exc
            raise
        return response["Body"].read()

    def list_keys(self) -> list[str]:
        keys: list[str] = []
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket):
            for item in page.get("Contents") or []:
                key = item.get("Key")
                if key:
                    keys.append(key)
        return sorted(keys)

    def materialize(self, key: str) -> tuple[Path, bool]:
        suffix = Path(key).suffix
        with NamedTemporaryFile(prefix="trackerx-obj-", suffix=suffix, delete=False) as tmp:
            tmp.write(self.get_bytes(key))
            return Path(tmp.name), True

    def file_response(
        self, key: str, filename: str, media_type: str, disposition: str
    ) -> Response:
        from botocore.exceptions import ClientError

        try:
            response = self._client.get_object(Bucket=self.bucket, Key=assert_object_key(key))
        except ClientError as exc:
            if self._missing(exc):
                raise ObjectNotFound(key) from exc
            raise
        body = response["Body"]

        def chunks() -> Iterator[bytes]:
            try:
                while True:
                    chunk = body.read(1024 * 1024)
                    if not chunk:
                        break
                    yield chunk
            finally:
                body.close()

        headers = {"Content-Disposition": _disposition(disposition, filename)}
        length = response.get("ContentLength")
        if length is not None:
            headers["Content-Length"] = str(length)
        return StreamingResponse(chunks(), media_type=media_type, headers=headers)


@lru_cache
def get_document_store() -> LocalDocumentStore | S3DocumentStore:
    if settings.uses_s3_storage:
        return S3DocumentStore()
    return LocalDocumentStore()


async def consume_upload(upload: UploadFile, max_bytes: int) -> tuple[BinaryIO, int]:
    buffer = SpooledTemporaryFile(max_size=min(max_bytes, 8 * 1024 * 1024), mode="w+b")
    total = 0
    while chunk := await upload.read(1024 * 1024):
        total += len(chunk)
        if total > max_bytes:
            buffer.close()
            raise UploadTooLarge()
        buffer.write(chunk)
    if total == 0:
        buffer.close()
        raise EmptyUpload()
    buffer.seek(0)
    return buffer, total


def serve_download(stored_path: str, filename: str, content_type: str | None) -> Response:
    try:
        key = object_key_from_stored(stored_path)
    except InvalidDocumentPath:
        raise HTTPException(status_code=410, detail="The stored file path is invalid.")
    store = get_document_store()
    if not store.exists(key):
        raise HTTPException(status_code=410, detail="File is no longer available on the server.")
    return store.file_response(
        key, filename, content_type or "application/octet-stream", "attachment"
    )


def serve_preview(stored_path: str, filename: str, content_type: str | None) -> Response:
    try:
        key = object_key_from_stored(stored_path)
    except InvalidDocumentPath:
        raise HTTPException(status_code=410, detail="The stored file path is invalid.")
    store = get_document_store()
    if not store.exists(key):
        raise HTTPException(status_code=410, detail="File is no longer available on the server.")
    path, ephemeral = store.materialize(key)
    try:
        preview = prepare_preview(path, filename, content_type)
    except PreviewUnavailable as exc:
        if ephemeral:
            _unlink(path)
        raise HTTPException(status_code=415, detail=str(exc))
    except Exception:
        if ephemeral:
            _unlink(path)
        raise
    headers = {
        "Content-Disposition": "inline",
        "X-Preview-Truncated": "true" if preview.truncated else "false",
    }
    if preview.kind == "binary":
        return FileResponse(
            path,
            filename=filename,
            media_type=preview.media_type,
            content_disposition_type="inline",
            headers=headers,
            background=BackgroundTask(_unlink, path) if ephemeral else None,
        )
    try:
        return PlainTextResponse(preview.text or "", media_type=preview.media_type, headers=headers)
    finally:
        if ephemeral:
            _unlink(path)


def migrate_local_files_to_store(root: Path | None = None) -> dict[str, int]:
    """Copy existing on-disk uploads into the configured object store."""

    source_root = (root or settings.documents_dir).resolve()
    store = get_document_store()
    store.ensure_ready()
    copied = 0
    skipped = 0
    if not source_root.exists():
        return {"copied": 0, "skipped": 0}
    for path in sorted(item for item in source_root.rglob("*") if item.is_file()):
        key = path.relative_to(source_root).as_posix()
        size = path.stat().st_size
        if store.exists(key) and store.object_size(key) == size:
            skipped += 1
            continue
        with path.open("rb") as source:
            store.put_fileobj(key, source, content_type=None, size=size)
        copied += 1
    return {"copied": copied, "skipped": skipped}
