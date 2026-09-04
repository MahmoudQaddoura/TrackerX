from __future__ import annotations

"""Build a styled, dependency-free Office Open XML asset inventory workbook."""

from collections import Counter
from datetime import datetime
from html import escape
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile


NAVY = "0B537A"
PALE = "EAF5FB"
LINE = "D7E3EC"


def _text(value: object | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        value = value.astimezone().strftime("%d %b %Y, %H:%M") if value.tzinfo else value.strftime("%d %b %Y, %H:%M")
    return escape(str(value), quote=False)


def _timestamp(value: object | None) -> object | None:
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    return value


def _column(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def _inline(row: int, column: int, value: object | None, style: int = 6) -> str:
    ref = f"{_column(column)}{row}"
    return f'<c r="{ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{_text(value)}</t></is></c>'


def _number(row: int, column: int, value: int | float, style: int = 7) -> str:
    return f'<c r="{_column(column)}{row}" s="{style}" t="n"><v>{value}</v></c>'


def _formula(row: int, column: int, formula: str, cached: int | float) -> str:
    return f'<c r="{_column(column)}{row}" s="8"><f>{escape(formula)}</f><v>{cached}</v></c>'


def _row(index: int, cells: list[str], height: int | None = None) -> str:
    sizing = f' ht="{height}" customHeight="1"' if height else ""
    return f'<row r="{index}"{sizing}>{"".join(cells)}</row>'


def _sheet(
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
            f'topLeftCell="{_column(freeze_columns + 1)}{freeze_rows + 1}" '
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
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:{_column(max_column)}{max_row}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0">{pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/><cols>{columns}</cols>
  <sheetData>{''.join(rows)}</sheetData>{filter_xml}{merge_xml}
  <pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>
  <pageSetup orientation="{orientation}" fitToWidth="1" fitToHeight="0"/>
</worksheet>'''


def _status_style(status: str | None) -> int:
    normalized = (status or "").lower()
    if normalized in {"active", "connected"}:
        return 9
    if normalized in {"maintenance", "review"}:
        return 10
    return 11


def _table_sheet(
    title: str,
    subtitle: str,
    headers: list[str],
    records: list[list[object | None]],
    widths: list[float],
    status_column: int | None = None,
) -> str:
    last_column = _column(len(headers))
    rows = [
        _row(1, [_inline(1, 1, title, 1)], 30),
        _row(2, [_inline(2, 1, subtitle, 2)], 22),
        _row(4, [_inline(4, index, label, 5) for index, label in enumerate(headers, 1)], 32),
    ]
    for row_index, record in enumerate(records, start=5):
        cells: list[str] = []
        for column_index, value in enumerate(record, start=1):
            style = _status_style(str(value)) if status_column == column_index else 6
            cells.append(
                _number(row_index, column_index, value)
                if isinstance(value, (int, float)) and not isinstance(value, bool)
                else _inline(row_index, column_index, value, style)
            )
        rows.append(_row(row_index, cells, 28))
    last_row = max(5, 4 + len(records))
    return _sheet(
        rows,
        len(headers),
        last_row,
        widths,
        merges=[f"A1:{last_column}1", f"A2:{last_column}2"],
        freeze_rows=4,
        freeze_columns=2,
        autofilter=f"A4:{last_column}{last_row}",
    )


def _styles() -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="10"/><name val="Yu Gothic"/><family val="2"/></font>
    <font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Yu Gothic"/><family val="2"/></font>
    <font><sz val="10"/><color rgb="FFDCECF5"/><name val="Yu Gothic"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Yu Gothic"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FF{NAVY}"/><name val="Yu Gothic"/><family val="2"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF{NAVY}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF{PALE}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE5F5EC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF1DD"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0F3F7"/></patternFill></fill>
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


def build_asset_inventory_excel(
    *,
    project_id: int,
    project_name: str,
    project_type: str,
    assets: list[dict],
    connections: list[dict],
    exported_by: str,
) -> bytes:
    """Return a complete TrackerX asset inventory as a styled .xlsx workbook."""

    generated_at = datetime.now().astimezone()
    project_type_label = {
        "actual_project": "Actual Project",
        "maintenance_support": "Maintenance & Support",
    }.get(project_type, project_type.replace("_", " ").title())
    environment_counts = Counter(asset.get("environment") or "Unspecified" for asset in assets)
    status_counts = Counter(asset.get("status") or "Unspecified" for asset in assets)
    asset_records: list[list[object | None]] = []
    port_records: list[list[object | None]] = []

    for asset in assets:
        ports = asset.get("ports") or []
        port_summary = ", ".join(
            f'{port.get("port")}/{str(port.get("protocol") or "").upper()} {port.get("service") or ""}'.strip()
            for port in ports
        )
        asset_records.append([
            asset.get("id"), asset.get("hostname"), asset.get("ip_address"), str(asset.get("environment") or "").replace("_", " ").title(),
            asset.get("purpose"), asset.get("tier"), asset.get("os"), asset.get("cpu"), asset.get("ram"),
            asset.get("storage"), asset.get("applications"), asset.get("database"), asset.get("services"),
            str(asset.get("status") or "").replace("_", " ").title(), asset.get("notes"), port_summary, asset.get("created_by_name"),
            _timestamp(asset.get("created_at")), _timestamp(asset.get("updated_at")),
        ])
        for port in ports:
            port_records.append([
                port.get("id"), asset.get("id"), asset.get("hostname"), asset.get("ip_address"),
                str(asset.get("environment") or "").replace("_", " ").title(), port.get("port"), str(port.get("protocol") or "").upper(),
                port.get("service"), port.get("notes"), _timestamp(port.get("created_at")), _timestamp(port.get("updated_at")),
            ])

    connection_records = [[
        item.get("id"), item.get("source_asset_id"), item.get("source_hostname"), item.get("source_ip_address"),
        item.get("destination_asset_id"), item.get("destination_hostname"), item.get("destination_ip_address"),
        item.get("port_id"), item.get("port"), str(item.get("protocol") or "").upper(), item.get("service"),
        str(item.get("status") or "").replace("_", " ").title(), _timestamp(item.get("updated_at")),
    ] for item in connections]

    asset_last = max(5, 4 + len(asset_records))
    port_last = max(5, 4 + len(port_records))
    connection_last = max(5, 4 + len(connection_records))
    overview_rows = [
        _row(1, [_inline(1, 1, "ASSET INVENTORY", 1)], 34),
        _row(2, [_inline(2, 1, f"{project_name} · {project_type_label}", 2)], 22),
        _row(4, [_inline(4, 1, "Project ID", 3), _inline(4, 3, project_id, 4), _inline(4, 6, "Prepared by", 3), _inline(4, 8, exported_by, 4)], 24),
        _row(5, [_inline(5, 1, "Generated", 3), _inline(5, 3, generated_at.strftime("%d %b %Y, %I:%M %p"), 4), _inline(5, 6, "Workbook scope", 3), _inline(5, 8, "Assets, ports and explicit connectivity rules", 4)], 24),
        _row(8, [_inline(8, 1, "ASSETS", 5), _inline(8, 4, "ENVIRONMENTS", 5), _inline(8, 7, "PORTS", 5), _inline(8, 10, "CONNECTIONS", 5)], 24),
        _row(9, [
            _formula(9, 1, f"COUNTA('Assets'!B5:B{asset_last})", len(assets)),
            _formula(
                9,
                4,
                "+".join(
                    f'IF(COUNTIF(\'Assets\'!D5:D{asset_last},"{environment}")>0,1,0)'
                    for environment in (
                        "Production",
                        "Staging",
                        "Development",
                        "Test",
                        "Disaster Recovery",
                        "Other",
                    )
                ),
                len(environment_counts),
            ),
            _formula(9, 7, f"COUNTA('Ports'!F5:F{port_last})", len(port_records)),
            _formula(9, 10, f"COUNTA('Connectivity'!A5:A{connection_last})", len(connections)),
        ], 34),
        _row(12, [_inline(12, 1, "ENVIRONMENT DISTRIBUTION", 5), _inline(12, 7, "STATUS DISTRIBUTION", 5)], 24),
    ]
    distribution_row = 13
    count_rows = max(len(environment_counts), len(status_counts), 1)
    environments = sorted(environment_counts.items())
    statuses = sorted(status_counts.items())
    for index in range(count_rows):
        cells: list[str] = []
        if index < len(environments):
            label, count = environments[index]
            cells.extend([_inline(distribution_row + index, 1, label.replace("_", " ").title()), _number(distribution_row + index, 3, count)])
        if index < len(statuses):
            label, count = statuses[index]
            cells.extend([_inline(distribution_row + index, 7, label.replace("_", " ").title(), _status_style(label)), _number(distribution_row + index, 9, count)])
        overview_rows.append(_row(distribution_row + index, cells, 24))
    note_row = distribution_row + count_rows + 2
    overview_rows.append(_row(note_row, [_inline(note_row, 1, "Edit and filter the detailed tabs as needed. Identifier columns remain numeric; IP addresses remain text.", 2)], 24))

    overview_xml = _sheet(
        overview_rows, 12, note_row, [14, 3, 13, 15, 3, 14, 14, 18, 10, 15, 10, 10],
        merges=["A1:L1", "A2:L2", "A4:B4", "C4:E4", "F4:G4", "H4:L4", "A5:B5", "C5:E5", "F5:G5", "H5:L5", "A8:C8", "D8:F8", "G8:I8", "J8:L8", "A9:C10", "D9:F10", "G9:I10", "J9:L10", "A12:F12", "G12:L12", f"A{note_row}:L{note_row}"],
        landscape=False,
    )
    assets_xml = _table_sheet(
        "ASSET REGISTER", f"{project_name} · complete infrastructure inventory",
        ["Asset ID", "Hostname", "IP Address", "Environment", "Purpose", "Tier", "Operating System", "CPU", "RAM", "Storage", "Applications", "Database", "Services", "Status", "Notes", "Destination Ports", "Created By", "Created At", "Updated At"],
        asset_records, [10, 20, 18, 15, 28, 15, 20, 14, 14, 16, 24, 20, 24, 15, 30, 32, 20, 22, 22], status_column=14,
    )
    ports_xml = _table_sheet(
        "DESTINATION PORTS", f"{project_name} · ports remain independent per asset and IP",
        ["Port ID", "Asset ID", "Hostname", "IP Address", "Environment", "Port", "Protocol", "Service", "Notes", "Created At", "Updated At"],
        port_records, [10, 10, 20, 18, 15, 10, 12, 24, 30, 22, 22],
    )
    connectivity_xml = _table_sheet(
        "CONNECTIVITY MATRIX", f"{project_name} · explicit source-to-destination-port decisions",
        ["Connection ID", "Source Asset ID", "Source Hostname", "Source IP", "Destination Asset ID", "Destination Hostname", "Destination IP", "Port ID", "Port", "Protocol", "Service", "Status", "Updated At"],
        connection_records, [14, 14, 22, 18, 17, 24, 18, 10, 10, 12, 24, 15, 22], status_column=12,
    )

    workbook_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="120" yWindow="120" windowWidth="24000" windowHeight="13500"/></bookViews><sheets><sheet name="Overview" sheetId="1" r:id="rId1"/><sheet name="Assets" sheetId="2" r:id="rId2"/><sheet name="Ports" sheetId="3" r:id="rId3"/><sheet name="Connectivity" sheetId="4" r:id="rId4"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'''
    workbook_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'''
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''
    package_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''
    core_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>TrackerX Asset Inventory - {_text(project_name)}</dc:title><dc:creator>{_text(exported_by)}</dc:creator><cp:lastModifiedBy>{_text(exported_by)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">{generated_at.astimezone().isoformat()}</dcterms:created></cp:coreProperties>'''
    app_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>TrackerX</Application><AppVersion>1.0</AppVersion><TitlesOfParts><vt:vector size="4" baseType="lpstr"><vt:lpstr>Overview</vt:lpstr><vt:lpstr>Assets</vt:lpstr><vt:lpstr>Ports</vt:lpstr><vt:lpstr>Connectivity</vt:lpstr></vt:vector></TitlesOfParts></Properties>'''

    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for path, content in {
            "[Content_Types].xml": content_types, "_rels/.rels": package_rels,
            "docProps/core.xml": core_xml, "docProps/app.xml": app_xml,
            "xl/workbook.xml": workbook_xml, "xl/_rels/workbook.xml.rels": workbook_rels,
            "xl/styles.xml": _styles(), "xl/worksheets/sheet1.xml": overview_xml,
            "xl/worksheets/sheet2.xml": assets_xml, "xl/worksheets/sheet3.xml": ports_xml,
            "xl/worksheets/sheet4.xml": connectivity_xml,
        }.items():
            archive.writestr(path, content)
    return output.getvalue()
