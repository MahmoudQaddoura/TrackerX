from __future__ import annotations

"""Safe, read-only previews for files already stored by TrackerX."""

from dataclasses import dataclass
import json
from pathlib import Path
import re
from zipfile import BadZipFile, ZipFile

from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException


MAX_TEXT_PREVIEW_BYTES = 5 * 1024 * 1024
MAX_OFFICE_UNPACKED_BYTES = 30 * 1024 * 1024

TEXT_SUFFIXES = {
    ".txt", ".log", ".csv", ".md", ".markdown", ".json", ".xml", ".yaml", ".yml",
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".cs", ".c", ".cpp", ".h",
    ".sql", ".sh", ".ps1", ".html", ".css", ".scss", ".toml", ".ini", ".conf",
    ".env", ".svg",
}


class PreviewUnavailable(Exception):
    pass


@dataclass(frozen=True)
class PreviewResult:
    kind: str
    media_type: str
    text: str | None = None
    truncated: bool = False


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _limit_text(value: str) -> tuple[str, bool]:
    encoded = value.encode("utf-8")
    if len(encoded) <= MAX_TEXT_PREVIEW_BYTES:
        return value, False
    return encoded[:MAX_TEXT_PREVIEW_BYTES].decode("utf-8", errors="ignore"), True


def _read_text(path: Path) -> tuple[str, bool]:
    with path.open("rb") as source:
        raw = source.read(MAX_TEXT_PREVIEW_BYTES + 1)
    truncated = len(raw) > MAX_TEXT_PREVIEW_BYTES
    raw = raw[:MAX_TEXT_PREVIEW_BYTES]
    if b"\x00" in raw[:4096]:
        raise PreviewUnavailable("Preview is not available for this binary file type.")
    try:
        value = raw.decode("utf-8")
    except UnicodeDecodeError:
        value = raw.decode("utf-8", errors="replace")
    return value, truncated


def _safe_zip(path: Path) -> ZipFile:
    try:
        archive = ZipFile(path)
    except (BadZipFile, OSError) as exc:
        raise PreviewUnavailable("This Office document is damaged or unsupported.") from exc
    if sum(item.file_size for item in archive.infolist()) > MAX_OFFICE_UNPACKED_BYTES:
        archive.close()
        raise PreviewUnavailable("This Office document is too large to preview safely.")
    return archive


def _xml_text(raw: bytes) -> list[str]:
    root = _parse_xml(raw)
    return [node.text or "" for node in root.iter() if _local_name(node.tag) == "t" and node.text]


def _parse_xml(raw: bytes):
    """Parse untrusted Office XML with entity and DTD expansion disabled."""
    try:
        return ElementTree.fromstring(raw)
    except (ElementTree.ParseError, DefusedXmlException) as exc:
        raise PreviewUnavailable("This document contains invalid preview content.") from exc


def _docx_text(path: Path) -> str:
    with _safe_zip(path) as archive:
        if "word/document.xml" not in archive.namelist():
            raise PreviewUnavailable("This Word document cannot be previewed.")
        root = _parse_xml(archive.read("word/document.xml"))
        paragraphs: list[str] = []
        for node in root.iter():
            if _local_name(node.tag) != "p":
                continue
            text = "".join(
                child.text or ""
                for child in node.iter()
                if _local_name(child.tag) == "t" and child.text
            ).strip()
            if text:
                paragraphs.append(text)
        return "\n\n".join(paragraphs)


def _numbered_name(value: str) -> tuple[int, str]:
    match = re.search(r"(\d+)", Path(value).stem)
    return (int(match.group(1)) if match else 0, value)


def _pptx_text(path: Path) -> str:
    with _safe_zip(path) as archive:
        slides = sorted(
            (
                name for name in archive.namelist()
                if name.startswith("ppt/slides/slide") and name.endswith(".xml")
            ),
            key=_numbered_name,
        )
        if not slides:
            raise PreviewUnavailable("This PowerPoint document cannot be previewed.")
        sections = []
        for index, slide in enumerate(slides, start=1):
            content = "\n".join(part for part in _xml_text(archive.read(slide)) if part.strip())
            sections.append(f"Slide {index}\n{content}".strip())
        return "\n\n".join(sections)


def _xlsx_text(path: Path) -> str:
    with _safe_zip(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = _parse_xml(archive.read("xl/sharedStrings.xml"))
            for item in root.iter():
                if _local_name(item.tag) == "si":
                    shared.append("".join(_xml_text(ElementTree.tostring(item))))

        sheets = sorted(
            (
                name for name in archive.namelist()
                if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
            ),
            key=_numbered_name,
        )
        if not sheets:
            raise PreviewUnavailable("This spreadsheet cannot be previewed.")
        output: list[str] = []
        for sheet_index, sheet in enumerate(sheets, start=1):
            root = _parse_xml(archive.read(sheet))
            output.append(f"Sheet {sheet_index}")
            for row in (node for node in root.iter() if _local_name(node.tag) == "row"):
                values: list[str] = []
                for cell in (node for node in row if _local_name(node.tag) == "c"):
                    cell_type = cell.attrib.get("t")
                    raw_value = next(
                        (node.text or "" for node in cell.iter() if _local_name(node.tag) in ("v", "t")),
                        "",
                    )
                    if cell_type == "s" and raw_value.isdigit() and int(raw_value) < len(shared):
                        raw_value = shared[int(raw_value)]
                    values.append(raw_value)
                if values:
                    output.append("\t".join(values))
            output.append("")
        return "\n".join(output).strip()


def prepare_preview(path: Path, original_name: str, declared_content_type: str | None) -> PreviewResult:
    suffix = Path(original_name).suffix.lower()
    with path.open("rb") as source:
        header = source.read(16)

    if header.startswith(b"%PDF-"):
        return PreviewResult(kind="binary", media_type="application/pdf")
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return PreviewResult(kind="binary", media_type="image/png")
    if header.startswith(b"\xff\xd8\xff"):
        return PreviewResult(kind="binary", media_type="image/jpeg")
    if header.startswith((b"GIF87a", b"GIF89a")):
        return PreviewResult(kind="binary", media_type="image/gif")
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return PreviewResult(kind="binary", media_type="image/webp")

    if suffix in (".docx", ".pptx", ".xlsx"):
        extractor = {".docx": _docx_text, ".pptx": _pptx_text, ".xlsx": _xlsx_text}[suffix]
        try:
            extracted = extractor(path)
        except PreviewUnavailable:
            raise
        except (ElementTree.ParseError, DefusedXmlException, KeyError, IndexError, OSError) as exc:
            raise PreviewUnavailable("This Office document is damaged or unsupported.") from exc
        content, truncated = _limit_text(extracted)
        return PreviewResult(kind="text", media_type="text/plain; charset=utf-8", text=content, truncated=truncated)

    is_declared_text = bool(
        declared_content_type
        and (
            declared_content_type.startswith("text/")
            or declared_content_type in ("application/json", "application/xml")
        )
    )
    if suffix in TEXT_SUFFIXES or is_declared_text:
        content, truncated = _read_text(path)
        if suffix == ".json":
            try:
                content = json.dumps(json.loads(content), indent=2, ensure_ascii=False)
            except json.JSONDecodeError:
                pass
        return PreviewResult(kind="text", media_type="text/plain; charset=utf-8", text=content, truncated=truncated)

    raise PreviewUnavailable("Preview is not available for this file type. You can still download the original file.")
