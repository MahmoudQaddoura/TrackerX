from __future__ import annotations

"""Build a complete, branded PDF for one project's asset inventory."""

from datetime import datetime
from html import escape
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image as PlatypusImage,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.services.attendance_pdf import (
    AMBER,
    COMPANY_LOGO_PATH,
    FONT_BOLD,
    FONT_REGULAR,
    GREEN,
    INK,
    LINE,
    MUTED,
    NAVY,
    PALE_AMBER,
    PALE_BLUE,
    PALE_GREEN,
    PALE_RED,
    ROW_ALT,
)


PAGE_SIZE = landscape(A4)
CONTENT_WIDTH = PAGE_SIZE[0] - 28 * mm

ENVIRONMENT_LABELS = {
    "production": "Production",
    "staging": "Staging",
    "development": "Development",
    "test": "Test",
    "disaster_recovery": "Disaster recovery",
    "other": "Other",
}
STATUS_LABELS = {
    "active": "Active",
    "maintenance": "Maintenance",
    "inactive": "Inactive",
    "retired": "Retired",
    "connected": "Connected",
    "closed": "Closed",
    "not_needed": "Not needed",
}


def _text(value: Any) -> str:
    return "-" if value is None or str(value).strip() == "" else str(value).strip()


def _paragraph(value: Any, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(_text(value)).replace("\n", "<br/>"), style)


def _lines(values: list[Any]) -> str:
    return "<br/>".join(escape(_text(value)) for value in values if _text(value) != "-") or "-"


def _page_frame(canvas: Canvas, document: BaseDocTemplate) -> None:
    """Draw the report-specific footer."""

    canvas.saveState()
    width, _ = PAGE_SIZE
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(14 * mm, 12 * mm, width - 14 * mm, 12 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT_REGULAR, 7.2)
    canvas.drawString(14 * mm, 7.5 * mm, "blockeXe | Asset Inventory")
    canvas.drawRightString(
        width - 14 * mm,
        7.5 * mm,
        f"Page {canvas.getPageNumber()}",
    )
    canvas.restoreState()


def _brand_header() -> Table:
    base = getSampleStyleSheet()
    report_style = ParagraphStyle(
        "AssetHeaderReportTitle",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=10,
        leading=12,
        textColor=INK,
        alignment=TA_CENTER,
    )
    logo_width = 39 * mm
    company_logo = PlatypusImage(
        str(COMPANY_LOGO_PATH),
        width=logo_width,
        height=logo_width * 872 / 3152,
    )
    company_logo.hAlign = "LEFT"
    header = Table(
        [[company_logo, Paragraph("ASSET INVENTORY", report_style), ""]],
        colWidths=[89 * mm, 91 * mm, 89 * mm],
        hAlign="LEFT",
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 0), (-1, 0), 1.2, NAVY),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5 * mm),
            ]
        )
    )
    return header


def _report_heading(
    project_name: str,
    project_type: str,
    prepared_by: str,
    generated_label: str,
) -> Table:
    base = getSampleStyleSheet()
    title = ParagraphStyle(
        "AssetReportHeading",
        parent=base["Heading1"],
        fontName=FONT_BOLD,
        fontSize=18,
        leading=21,
        textColor=INK,
    )
    meta = ParagraphStyle(
        "AssetReportMeta",
        parent=base["Normal"],
        fontName=FONT_REGULAR,
        fontSize=7.2,
        leading=10,
        textColor=MUTED,
        alignment=TA_RIGHT,
    )
    type_label = (
        "Maintenance & Support" if project_type == "maintenance_support" else "Actual Project"
    )
    heading = Table(
        [
            [
                Paragraph(
                    f"{escape(project_name)}<br/><font size='8.5' color='#667085'>"
                    f"{escape(type_label)} · Complete infrastructure register</font>",
                    title,
                ),
                Paragraph(
                    f"<b>Prepared by</b><br/>{escape(prepared_by)}<br/><br/>"
                    f"<b>Generated</b><br/>{escape(generated_label)}",
                    meta,
                ),
            ]
        ],
        colWidths=[202 * mm, 67 * mm],
        hAlign="LEFT",
    )
    heading.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 9 * mm),
                ("LEFTPADDING", (1, 0), (1, 0), 5 * mm),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("LINEBEFORE", (1, 0), (1, 0), 0.7, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return heading


def _metric_card(label: str, value: int, background: colors.Color, accent: colors.Color) -> Table:
    base = getSampleStyleSheet()
    label_style = ParagraphStyle(
        f"AssetMetricLabel{label}",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=6.4,
        leading=8,
        textColor=MUTED,
        alignment=TA_CENTER,
    )
    value_style = ParagraphStyle(
        f"AssetMetricValue{label}",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=14,
        leading=16,
        textColor=accent,
        alignment=TA_CENTER,
    )
    card = Table(
        [[Paragraph(label.upper(), label_style)], [Paragraph(str(value), value_style)]],
        colWidths=[51 * mm],
    )
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.55, LINE),
                ("LINEABOVE", (0, 0), (-1, 0), 1.6, accent),
                ("TOPPADDING", (0, 0), (-1, 0), 2.1 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 0.3 * mm),
                ("TOPPADDING", (0, 1), (-1, 1), 0),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 2.1 * mm),
            ]
        )
    )
    return card


def _section_heading(title: str, description: str, count_label: str) -> Table:
    base = getSampleStyleSheet()
    heading_style = ParagraphStyle(
        f"AssetSection{title}",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=10.5,
        leading=13,
        textColor=INK,
    )
    description_style = ParagraphStyle(
        f"AssetSectionDescription{title}",
        parent=base["Normal"],
        fontName=FONT_REGULAR,
        fontSize=7,
        leading=9,
        textColor=MUTED,
    )
    count_style = ParagraphStyle(
        f"AssetSectionCount{title}",
        parent=description_style,
        fontName=FONT_BOLD,
        textColor=NAVY,
        alignment=TA_RIGHT,
    )
    table = Table(
        [
            [
                Paragraph(
                    f"{escape(title)}<br/><font size='7' color='#667085'>{escape(description)}</font>",
                    heading_style,
                ),
                Paragraph(escape(count_label), count_style),
            ]
        ],
        colWidths=[214 * mm, 55 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8 * mm),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ]
        )
    )
    return table


def _empty_panel(message: str) -> Table:
    base = getSampleStyleSheet()
    style = ParagraphStyle(
        "AssetEmptyPanel",
        parent=base["Normal"],
        fontName=FONT_REGULAR,
        fontSize=8,
        leading=10,
        textColor=MUTED,
        alignment=TA_CENTER,
    )
    panel = Table([[Paragraph(escape(message), style)]], colWidths=[CONTENT_WIDTH])
    panel.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ROW_ALT),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 8 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8 * mm),
            ]
        )
    )
    return panel


def _table_styles() -> tuple[ParagraphStyle, ParagraphStyle, ParagraphStyle, ParagraphStyle]:
    base = getSampleStyleSheet()
    header = ParagraphStyle(
        "AssetTableHeader",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=6.1,
        leading=7.5,
        textColor=NAVY,
    )
    cell = ParagraphStyle(
        "AssetTableCell",
        parent=base["Normal"],
        fontName=FONT_REGULAR,
        fontSize=6.4,
        leading=8.2,
        textColor=INK,
    )
    cell_bold = ParagraphStyle("AssetTableCellBold", parent=cell, fontName=FONT_BOLD)
    muted = ParagraphStyle("AssetTableMuted", parent=cell, textColor=MUTED)
    return header, cell, cell_bold, muted


def _styled_table(
    data: list[list[Any]],
    widths: list[float],
    status_column: int | None = None,
    status_values: list[str] | None = None,
) -> Table:
    table = Table(data, colWidths=[width * mm for width in widths], repeatRows=1, hAlign="LEFT")
    commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), PALE_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.1 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.1 * mm),
        ("TOPPADDING", (0, 0), (-1, 0), 2.7 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2.7 * mm),
        ("TOPPADDING", (0, 1), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 2 * mm),
    ]
    status_backgrounds = {
        "active": PALE_GREEN,
        "maintenance": PALE_AMBER,
        "inactive": ROW_ALT,
        "retired": ROW_ALT,
        "connected": PALE_GREEN,
        "closed": PALE_RED,
        "not_needed": ROW_ALT,
    }
    for index in range(1, len(data)):
        if index % 2 == 0:
            commands.append(("BACKGROUND", (0, index), (-1, index), ROW_ALT))
        commands.append(("LINEBELOW", (0, index), (-1, index), 0.35, LINE))
        if status_column is not None and status_values and index - 1 < len(status_values):
            background = status_backgrounds.get(status_values[index - 1])
            if background is not None:
                commands.append(
                    ("BACKGROUND", (status_column, index), (status_column, index), background)
                )
    table.setStyle(TableStyle(commands))
    return table


def build_asset_inventory_pdf(
    project_name: str,
    project_type: str,
    assets: list[dict[str, Any]],
    connections: list[dict[str, Any]],
    prepared_by: str,
    generated_at: datetime | None = None,
) -> bytes:
    """Return a print-ready asset register, port catalog, and network-rule report."""

    created = generated_at or datetime.now().astimezone()
    buffer = BytesIO()
    document = BaseDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=18 * mm,
        title=f"TrackerX Asset Inventory - {project_name}",
        author=prepared_by,
        subject="Complete project asset inventory, destination ports, and network rules",
    )
    frame = Frame(
        document.leftMargin,
        document.bottomMargin,
        document.width,
        document.height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
        id="asset-inventory-frame",
    )
    document.addPageTemplates(
        [PageTemplate(id="asset-inventory", frames=[frame], onPage=_page_frame)]
    )
    header, cell, cell_bold, muted = _table_styles()

    environments = {asset["environment"] for asset in assets}
    ports = [port for asset in assets for port in asset.get("ports", [])]
    maintenance = sum(asset["status"] == "maintenance" for asset in assets)
    connected = sum(rule["status"] == "connected" for rule in connections)

    story: list[Any] = [
        _brand_header(),
        Spacer(1, 6 * mm),
        _report_heading(
            project_name,
            project_type,
            prepared_by,
            created.strftime("%d %b %Y, %I:%M %p"),
        ),
        Spacer(1, 5.5 * mm),
    ]
    summary = Table(
        [
            [
                _metric_card("Assets", len(assets), ROW_ALT, NAVY),
                "",
                _metric_card("Environments", len(environments), PALE_BLUE, NAVY),
                "",
                _metric_card("Tracked ports", len(ports), PALE_BLUE, NAVY),
                "",
                _metric_card("Connected rules", connected, PALE_GREEN, GREEN),
                "",
                _metric_card("Maintenance", maintenance, PALE_AMBER, AMBER),
            ]
        ],
        colWidths=[51 * mm, 3 * mm, 51 * mm, 3 * mm, 51 * mm, 3 * mm, 51 * mm, 3 * mm, 51 * mm],
    )
    summary.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.extend(
        [
            summary,
            Spacer(1, 6 * mm),
            _section_heading(
                "Asset register",
                "Identity, ownership, capacity, workloads, status, and operational notes.",
                f"{len(assets)} assets",
            ),
        ]
    )

    asset_data: list[list[Any]] = [
        [
            _paragraph("ASSET / IP", header),
            _paragraph("ENVIRONMENT", header),
            _paragraph("PURPOSE / NOTES", header),
            _paragraph("PLATFORM / CAPACITY", header),
            _paragraph("APPLICATIONS / SERVICES", header),
            _paragraph("STATUS / PORTS", header),
        ]
    ]
    asset_statuses: list[str] = []
    for asset in assets:
        asset_ports = asset.get("ports", [])
        port_lines = [
            f"{port['port']}/{str(port['protocol']).upper()} · {port['service']}"
            for port in asset_ports
        ]
        asset_data.append(
            [
                Paragraph(
                    f"<font name='{FONT_BOLD}'>{escape(_text(asset['hostname']))}</font><br/>"
                    f"<font color='#0B5279'>{escape(_text(asset['ip_address']))}</font>",
                    cell,
                ),
                _paragraph(ENVIRONMENT_LABELS.get(asset["environment"], asset["environment"]), cell),
                Paragraph(
                    _lines([asset.get("purpose"), asset.get("tier"), asset.get("notes")]),
                    muted,
                ),
                Paragraph(
                    _lines(
                        [
                            asset.get("os"),
                            " · ".join(
                                _text(value)
                                for value in (asset.get("cpu"), asset.get("ram"), asset.get("storage"))
                                if _text(value) != "-"
                            ),
                        ]
                    ),
                    cell,
                ),
                Paragraph(
                    _lines([asset.get("applications"), asset.get("database"), asset.get("services")]),
                    cell,
                ),
                Paragraph(
                    f"<font name='{FONT_BOLD}'>{escape(STATUS_LABELS.get(asset['status'], asset['status']))}</font>"
                    f"<br/>{'<br/>'.join(escape(line) for line in port_lines) if port_lines else 'No tracked ports'}",
                    cell,
                ),
            ]
        )
        asset_statuses.append(asset["status"])
    story.append(
        _styled_table(
            asset_data,
            [39, 25, 52, 51, 60, 42],
            status_column=5,
            status_values=asset_statuses,
        )
        if assets
        else _empty_panel("No assets are recorded for this project.")
    )

    story.extend(
        [
            PageBreak(),
            _brand_header(),
            Spacer(1, 6 * mm),
            _section_heading(
                "Destination port catalog",
                "Each IP can own multiple ports; every port is tracked independently by protocol and service.",
                f"{len(ports)} ports",
            ),
        ]
    )
    port_data: list[list[Any]] = [
        [
            _paragraph("DESTINATION ASSET", header),
            _paragraph("IP ADDRESS", header),
            _paragraph("ENVIRONMENT", header),
            _paragraph("PORT / PROTOCOL", header),
            _paragraph("SERVICE", header),
            _paragraph("PORT NOTE", header),
        ]
    ]
    for asset in assets:
        for port in asset.get("ports", []):
            port_data.append(
                [
                    _paragraph(asset["hostname"], cell_bold),
                    _paragraph(asset["ip_address"], cell),
                    _paragraph(ENVIRONMENT_LABELS.get(asset["environment"], asset["environment"]), cell),
                    _paragraph(f"{port['port']} / {str(port['protocol']).upper()}", cell_bold),
                    _paragraph(port.get("service"), cell),
                    _paragraph(port.get("notes"), muted),
                ]
            )
    story.append(
        _styled_table(port_data, [38, 32, 28, 28, 55, 88])
        if ports
        else _empty_panel("No destination ports are recorded for this project.")
    )

    story.extend(
        [
            PageBreak(),
            _brand_header(),
            Spacer(1, 6 * mm),
            _section_heading(
                "Network connection rules",
                "Source-to-port decisions across every environment, including connected, closed, and not-needed states.",
                f"{len(connections)} rules",
            ),
        ]
    )
    connection_data: list[list[Any]] = [
        [
            _paragraph("SOURCE ASSET", header),
            _paragraph("SOURCE IP", header),
            _paragraph("DESTINATION ASSET", header),
            _paragraph("DESTINATION IP", header),
            _paragraph("PORT", header),
            _paragraph("SERVICE", header),
            _paragraph("STATE", header),
        ]
    ]
    connection_statuses: list[str] = []
    for rule in connections:
        connection_data.append(
            [
                _paragraph(rule["source_hostname"], cell_bold),
                _paragraph(rule["source_ip_address"], cell),
                _paragraph(rule["destination_hostname"], cell_bold),
                _paragraph(rule["destination_ip_address"], cell),
                _paragraph(f"{rule['port']}/{str(rule['protocol']).upper()}", cell_bold),
                _paragraph(rule["service"], cell),
                _paragraph(STATUS_LABELS.get(rule["status"], rule["status"]), cell_bold),
            ]
        )
        connection_statuses.append(rule["status"])
    story.append(
        _styled_table(
            connection_data,
            [42, 32, 42, 32, 28, 53, 40],
            status_column=6,
            status_values=connection_statuses,
        )
        if connections
        else _empty_panel("No network connection decisions are recorded for this project.")
    )
    story.extend(
        [
            Spacer(1, 4 * mm),
            Paragraph(
                "This report includes every asset, destination port, and explicitly recorded network decision saved in TrackerX at export time.",
                ParagraphStyle(
                    "AssetReportDefinition",
                    parent=getSampleStyleSheet()["Normal"],
                    fontName=FONT_REGULAR,
                    fontSize=7,
                    leading=9,
                    textColor=MUTED,
                    alignment=TA_LEFT,
                ),
            ),
        ]
    )

    document.build(story)
    return buffer.getvalue()
