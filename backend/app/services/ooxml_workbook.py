from __future__ import annotations

"""Small, security-conscious OOXML helpers for TrackerX Excel workflows.

The application only needs a predictable subset of .xlsx: styled tabular
exports and values imported from those tables. Keeping this code independent
from a desktop Excel runtime makes exports deterministic on the Linux server.
"""

from dataclasses import dataclass
from html import escape
from io import BytesIO
from pathlib import PurePosixPath
import re
from zipfile import BadZipFile, ZIP_DEFLATED, ZipFile

from defusedxml import ElementTree as ET


NAVY = "0B537A"
PALE = "EAF5FB"
LINE = "D7E3EC"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_CELL_REF = re.compile(r"^([A-Z]+)([1-9][0-9]*)$")


@dataclass(frozen=True)
class WorkbookCell:
    value: str | int | float | bool | None
    formula: bool = False


@dataclass(frozen=True)
class WorkbookRow:
    number: int
    values: dict[str, WorkbookCell]


class WorkbookFormatError(ValueError):
    """Raised when an upload is not a safe, supported .xlsx workbook."""


def xml_text(value: object | None) -> str:
    return escape("" if value is None else str(value), quote=False)


def column_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def text_cell(row: int, column: int, value: object | None, style: int = 6) -> str:
    ref = f"{column_name(column)}{row}"
    return (
        f'<c r="{ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">'
        f"{xml_text(value)}</t></is></c>"
    )


def number_cell(row: int, column: int, value: int | float, style: int = 7) -> str:
    return f'<c r="{column_name(column)}{row}" s="{style}" t="n"><v>{value}</v></c>'


def row_xml(index: int, cells: list[str], height: int | None = None) -> str:
    sizing = f' ht="{height}" customHeight="1"' if height else ""
    return f'<row r="{index}"{sizing}>{"".join(cells)}</row>'


def sheet_xml(
    rows: list[str],
    max_column: int,
    max_row: int,
    widths: list[float],
    *,
    merges: list[str] | None = None,
    freeze_rows: int = 0,
    freeze_columns: int = 0,
    autofilter: str | None = None,
    landscape: bool = True,
) -> str:
    columns = "".join(
        f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>'
        for index, width in enumerate(widths, start=1)
    )
    pane = ""
    if freeze_rows or freeze_columns:
        pane = (
            f'<pane xSplit="{freeze_columns}" ySplit="{freeze_rows}" '
            f'topLeftCell="{column_name(freeze_columns + 1)}{freeze_rows + 1}" '
            'activePane="bottomRight" state="frozen"/>'
        )
    merge_xml = ""
    if merges:
        merge_xml = f'<mergeCells count="{len(merges)}">' + "".join(
            f'<mergeCell ref="{ref}"/>' for ref in merges
        ) + "</mergeCells>"
    filter_xml = f'<autoFilter ref="{autofilter}"/>' if autofilter else ""
    orientation = "landscape" if landscape else "portrait"
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="{_MAIN_NS}">
  <dimension ref="A1:{column_name(max_column)}{max_row}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0">{pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/><cols>{columns}</cols>
  <sheetData>{''.join(rows)}</sheetData>{filter_xml}{merge_xml}
  <pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>
  <pageSetup orientation="{orientation}" fitToWidth="1" fitToHeight="0"/>
</worksheet>'''


def table_sheet_xml(
    title: str,
    subtitle: str,
    headers: list[str],
    records: list[list[object | None]],
    widths: list[float],
    *,
    status_columns: set[int] | None = None,
) -> str:
    last_column = column_name(len(headers))
    rows = [
        row_xml(1, [text_cell(1, 1, title, 1)], 30),
        row_xml(2, [text_cell(2, 1, subtitle, 2)], 22),
        row_xml(4, [text_cell(4, index, label, 5) for index, label in enumerate(headers, 1)], 34),
    ]
    for row_index, record in enumerate(records, start=5):
        cells: list[str] = []
        for column_index, value in enumerate(record, start=1):
            normalized = str(value or "").strip().lower().replace(" ", "_")
            if status_columns and column_index in status_columns:
                style = 9 if normalized in {"active", "connected", "done"} else 10 if normalized in {"maintenance", "in_progress", "in_review"} else 11
            else:
                style = 6
            cells.append(
                number_cell(row_index, column_index, value)
                if isinstance(value, (int, float)) and not isinstance(value, bool)
                else text_cell(row_index, column_index, value, style)
            )
        rows.append(row_xml(row_index, cells, 28))
    last_row = max(5, 4 + len(records))
    return sheet_xml(
        rows,
        len(headers),
        last_row,
        widths,
        merges=[f"A1:{last_column}1", f"A2:{last_column}2"],
        freeze_rows=4,
        freeze_columns=min(2, len(headers)),
        autofilter=f"A4:{last_column}{last_row}",
    )


def trackerx_styles_xml() -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="{_MAIN_NS}">
  <fonts count="6">
    <font><sz val="10"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>
    <font><sz val="10"/><color rgb="FFDCECF5"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FF{NAVY}"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FF{NAVY}"/><name val="Arial"/><family val="2"/></font>
  </fonts>
  <fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF{NAVY}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF{PALE}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE5F5EC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF1DD"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0F3F7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDE7EC"/></patternFill></fill>
  </fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF{LINE}"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''


def package_xlsx(
    sheets: list[tuple[str, str]], *, title: str, creator: str, styles: str | None = None
) -> bytes:
    if not sheets:
        raise ValueError("An Excel workbook needs at least one worksheet.")
    if len({name.casefold() for name, _ in sheets}) != len(sheets):
        raise ValueError("Worksheet names must be unique.")
    sheet_nodes = "".join(
        f'<sheet name="{xml_text(name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, (name, _) in enumerate(sheets, start=1)
    )
    relationships = "".join(
        f'<Relationship Id="rId{index}" Type="{_DOC_REL_NS}/worksheet" Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, len(sheets) + 1)
    )
    relationships += f'<Relationship Id="rId{len(sheets) + 1}" Type="{_DOC_REL_NS}/styles" Target="styles.xml"/>'
    content_overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, len(sheets) + 1)
    )
    workbook_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="{_MAIN_NS}" xmlns:r="{_DOC_REL_NS}"><sheets>{sheet_nodes}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'''
    workbook_rels = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="{_REL_NS}">{relationships}</Relationships>'''
    content_types = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>{content_overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''
    package_rels = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="{_REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''
    core_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>{xml_text(title)}</dc:title><dc:creator>{xml_text(creator)}</dc:creator><cp:lastModifiedBy>{xml_text(creator)}</cp:lastModifiedBy></cp:coreProperties>'''
    titles = "".join(f"<vt:lpstr>{xml_text(name)}</vt:lpstr>" for name, _ in sheets)
    app_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>TrackerX</Application><TitlesOfParts><vt:vector size="{len(sheets)}" baseType="lpstr">{titles}</vt:vector></TitlesOfParts></Properties>'''

    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        files = {
            "[Content_Types].xml": content_types,
            "_rels/.rels": package_rels,
            "docProps/core.xml": core_xml,
            "docProps/app.xml": app_xml,
            "xl/workbook.xml": workbook_xml,
            "xl/_rels/workbook.xml.rels": workbook_rels,
            "xl/styles.xml": styles or trackerx_styles_xml(),
        }
        files.update(
            {f"xl/worksheets/sheet{index}.xml": content for index, (_, content) in enumerate(sheets, start=1)}
        )
        for path, content in files.items():
            archive.writestr(path, content)
    return output.getvalue()


def _column_index(reference: str) -> int:
    match = _CELL_REF.match(reference.upper())
    if not match:
        raise WorkbookFormatError(f"Invalid cell reference '{reference}'.")
    index = 0
    for character in match.group(1):
        index = index * 26 + ord(character) - 64
    return index


def _safe_xml(archive: ZipFile, name: str) -> ET.Element:
    try:
        raw = archive.read(name)
    except KeyError as exc:
        raise WorkbookFormatError(f"Workbook is missing {name}.") from exc
    try:
        return ET.fromstring(raw)
    except ET.ParseError as exc:
        raise WorkbookFormatError(f"Workbook contains invalid XML in {name}.") from exc


def read_xlsx(raw: bytes, *, max_rows: int = 5_000, max_columns: int = 100) -> dict[str, list[WorkbookRow]]:
    """Read cell values from a bounded .xlsx file without evaluating formulas."""
    try:
        archive = ZipFile(BytesIO(raw))
    except BadZipFile as exc:
        raise WorkbookFormatError("Upload a valid .xlsx workbook.") from exc
    with archive:
        entries = archive.infolist()
        if len(entries) > 250:
            raise WorkbookFormatError("Workbook contains too many internal files.")
        if len({item.filename for item in entries}) != len(entries):
            raise WorkbookFormatError("Workbook contains duplicate internal files.")
        total_size = sum(item.file_size for item in entries)
        if total_size > 50 * 1024 * 1024 or any(item.file_size > 20 * 1024 * 1024 for item in entries):
            raise WorkbookFormatError("Expanded workbook exceeds the 50 MB safety limit.")
        names = {item.filename for item in entries}
        if any(name.startswith("xl/externalLinks/") or name.endswith("vbaProject.bin") for name in names):
            raise WorkbookFormatError("Macros and external workbook links are not accepted.")

        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            root = _safe_xml(archive, "xl/sharedStrings.xml")
            for item in root.findall(f"{{{_MAIN_NS}}}si"):
                shared.append("".join(item.itertext()))

        rel_root = _safe_xml(archive, "xl/_rels/workbook.xml.rels")
        relations = {
            node.attrib.get("Id", ""): node.attrib.get("Target", "")
            for node in rel_root.findall(f"{{{_REL_NS}}}Relationship")
            if node.attrib.get("Type", "").endswith("/worksheet")
        }
        workbook = _safe_xml(archive, "xl/workbook.xml")
        result: dict[str, list[WorkbookRow]] = {}
        total_rows = 0
        for sheet in workbook.findall(f".//{{{_MAIN_NS}}}sheet"):
            sheet_name = sheet.attrib.get("name", "").strip()
            relation_id = sheet.attrib.get(f"{{{_DOC_REL_NS}}}id", "")
            target = relations.get(relation_id)
            if not sheet_name or not target:
                continue
            if sheet_name in result:
                raise WorkbookFormatError(f"Workbook contains duplicate worksheet name '{sheet_name}'.")
            normalized_target = str(PurePosixPath("xl") / target.lstrip("/"))
            if target.startswith("/xl/"):
                normalized_target = target.lstrip("/")
            normalized_target = str(PurePosixPath(normalized_target))
            if not normalized_target.startswith("xl/worksheets/") or normalized_target not in names:
                raise WorkbookFormatError("Workbook contains an invalid worksheet target.")
            sheet_root = _safe_xml(archive, normalized_target)
            rows: list[WorkbookRow] = []
            for row in sheet_root.findall(f".//{{{_MAIN_NS}}}sheetData/{{{_MAIN_NS}}}row"):
                try:
                    row_number = int(row.attrib.get("r", "0") or 0)
                except ValueError as exc:
                    raise WorkbookFormatError(
                        f"Worksheet '{sheet_name}' contains an invalid row reference."
                    ) from exc
                if row_number < 1 or row_number > max_rows:
                    raise WorkbookFormatError(f"Worksheet '{sheet_name}' exceeds {max_rows:,} rows.")
                values: dict[str, WorkbookCell] = {}
                for cell in row.findall(f"{{{_MAIN_NS}}}c"):
                    reference = cell.attrib.get("r", "")
                    column_index = _column_index(reference)
                    if column_index > max_columns:
                        raise WorkbookFormatError(
                            f"Worksheet '{sheet_name}' exceeds {max_columns} columns."
                        )
                    column = column_name(column_index)
                    kind = cell.attrib.get("t")
                    formula = cell.find(f"{{{_MAIN_NS}}}f") is not None
                    value_node = cell.find(f"{{{_MAIN_NS}}}v")
                    if kind == "inlineStr":
                        inline = cell.find(f"{{{_MAIN_NS}}}is")
                        value: str | int | float | bool | None = "".join(inline.itertext()) if inline is not None else ""
                    elif kind == "s":
                        try:
                            value = shared[int(value_node.text or "0")] if value_node is not None else ""
                        except (IndexError, ValueError) as exc:
                            raise WorkbookFormatError("Workbook contains an invalid shared string reference.") from exc
                    elif kind in {"str", "e"}:
                        value = value_node.text if value_node is not None else ""
                    elif kind == "b":
                        value = bool(int(value_node.text or "0")) if value_node is not None else False
                    else:
                        text = value_node.text if value_node is not None else None
                        if text in {None, ""}:
                            value = None
                        else:
                            try:
                                numeric = float(text)
                                value = int(numeric) if numeric.is_integer() else numeric
                            except ValueError:
                                value = text
                    values[column] = WorkbookCell(value=value, formula=formula)
                if values:
                    rows.append(WorkbookRow(number=row_number, values=values))
                    total_rows += 1
                    if total_rows > max_rows:
                        raise WorkbookFormatError(f"Workbook exceeds {max_rows:,} populated rows.")
            result[sheet_name] = rows
        return result


def table_rows(
    workbook: dict[str, list[WorkbookRow]],
    sheet_name: str,
    *,
    required_headers: set[str],
) -> list[tuple[int, dict[str, WorkbookCell]]]:
    """Return rows mapped by visible headers, locating the header near the top."""
    rows = workbook.get(sheet_name)
    if rows is None:
        raise WorkbookFormatError(f"Workbook is missing the '{sheet_name}' worksheet.")
    header_row: WorkbookRow | None = None
    header_by_column: dict[str, str] = {}
    for candidate in rows[:20]:
        mapped = {
            column: str(cell.value or "").strip()
            for column, cell in candidate.values.items()
            if str(cell.value or "").strip()
        }
        if required_headers.issubset(set(mapped.values())):
            header_row = candidate
            header_by_column = mapped
            break
    if header_row is None:
        expected = ", ".join(sorted(required_headers))
        raise WorkbookFormatError(f"'{sheet_name}' is missing required columns: {expected}.")
    if len(set(header_by_column.values())) != len(header_by_column):
        raise WorkbookFormatError(f"'{sheet_name}' contains duplicate column names.")
    output: list[tuple[int, dict[str, WorkbookCell]]] = []
    for row in rows:
        if row.number <= header_row.number:
            continue
        mapped = {
            header: row.values.get(column, WorkbookCell(None))
            for column, header in header_by_column.items()
        }
        if any(cell.value not in {None, ""} for cell in mapped.values()):
            output.append((row.number, mapped))
    return output
