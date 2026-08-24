from __future__ import annotations

"""Build the branded TrackerX daily-attendance PDF."""

from datetime import date, datetime
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    Image as PlatypusImage,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


NAVY = colors.HexColor("#0B5279")
INK = colors.HexColor("#142033")
MUTED = colors.HexColor("#667085")
LINE = colors.HexColor("#D9E1EA")
PALE_BLUE = colors.HexColor("#EAF4FA")
PALE_GREEN = colors.HexColor("#EAF8EF")
PALE_AMBER = colors.HexColor("#FFF6E5")
PALE_RED = colors.HexColor("#FDECEF")
ROW_ALT = colors.HexColor("#F8FAFC")
COMPANY_LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "blockexe-logo.png"

STATUS_LABELS = {
    "not_recorded": "Not recorded",
    "present": "Present",
    "remote": "Remote",
    "leave": "Leave",
    "sick_leave": "Sick leave",
    "absent": "Absent",
}


def _paragraph(value: Any, style: ParagraphStyle) -> Paragraph:
    text = "-" if value is None or str(value).strip() == "" else str(value)
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def _brand_header(report_title: str) -> Table:
    base = getSampleStyleSheet()
    trackerx_style = ParagraphStyle(
        "HeaderTrackerX",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=20,
        textColor=colors.white,
        spaceAfter=0,
    )
    report_style = ParagraphStyle(
        "HeaderReportTitle",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=TA_RIGHT,
    )
    company_logo = PlatypusImage(
        str(COMPANY_LOGO_PATH),
        width=62 * mm,
        height=62 * mm * 872 / 3152,
    )
    company_logo.hAlign = "CENTER"
    header = Table(
        [[Paragraph("TrackerX", trackerx_style), company_logo, Paragraph(report_title, report_style)]],
        colWidths=[38 * mm, 70 * mm, 51 * mm],
        hAlign="LEFT",
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                ("BACKGROUND", (1, 0), (1, 0), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (0, 0), 6 * mm),
                ("RIGHTPADDING", (0, 0), (0, 0), 2 * mm),
                ("LEFTPADDING", (1, 0), (1, 0), 4 * mm),
                ("RIGHTPADDING", (1, 0), (1, 0), 4 * mm),
                ("LEFTPADDING", (2, 0), (2, 0), 3 * mm),
                ("RIGHTPADDING", (2, 0), (2, 0), 6 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return header


def _footer(canvas: Canvas, document: SimpleDocTemplate) -> None:
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    report_name = (
        "Monthly Days Off" if "Monthly Days Off" in document.title else "Daily Attendance"
    )
    canvas.drawString(18 * mm, 9 * mm, f"TrackerX | {report_name}")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def build_attendance_pdf(
    attendance_date: str,
    rows: list[dict[str, Any]],
    prepared_by: str,
    generated_at: datetime | None = None,
) -> bytes:
    """Return a static, print-ready PDF for the supplied attendance values."""

    day = date.fromisoformat(attendance_date)
    created = generated_at or datetime.now().astimezone()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=20 * mm,
        title=f"TrackerX Daily Attendance - {attendance_date}",
        author=prepared_by,
        subject="Daily employee attendance sheet",
    )

    base = getSampleStyleSheet()
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=MUTED,
        textTransform="uppercase",
    )
    meta_value = ParagraphStyle(
        "MetaValue",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=INK,
    )
    cell_style = ParagraphStyle(
        "Cell",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=INK,
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )
    header_style = ParagraphStyle(
        "TableHeader",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8,
        textColor=colors.white,
    )
    note_style = ParagraphStyle(
        "Note",
        parent=cell_style,
        fontSize=7,
        leading=8.5,
        textColor=MUTED,
    )

    story: list[Any] = []
    story.extend([_brand_header("DAILY ATTENDANCE"), Spacer(1, 5 * mm)])

    meta = Table(
        [
            [
                Paragraph("Attendance date", meta_label),
                Paragraph("Prepared by", meta_label),
                Paragraph("Generated", meta_label),
            ],
            [
                Paragraph(day.strftime("%A, %d %B %Y"), meta_value),
                Paragraph(escape(prepared_by), meta_value),
                Paragraph(created.strftime("%d %b %Y, %I:%M %p"), meta_value),
            ],
        ],
        colWidths=[62 * mm, 53 * mm, 44 * mm],
    )
    meta.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("TOPPADDING", (0, 0), (-1, 0), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 1 * mm),
                ("TOPPADDING", (0, 1), (-1, 1), 1 * mm),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 3 * mm),
            ]
        )
    )

    total = len(rows)
    on_duty = sum(row["status"] in ("present", "remote") for row in rows)
    away = sum(row["status"] in ("leave", "sick_leave", "absent") for row in rows)
    unrecorded = sum(row["status"] == "not_recorded" for row in rows)
    summary = Table(
        [
            [
                Paragraph("EMPLOYEES", meta_label),
                Paragraph("ON DUTY", meta_label),
                Paragraph("AWAY", meta_label),
                Paragraph("UNRECORDED", meta_label),
            ],
            [
                Paragraph(str(total), meta_value),
                Paragraph(str(on_duty), meta_value),
                Paragraph(str(away), meta_value),
                Paragraph(str(unrecorded), meta_value),
            ],
        ],
        colWidths=[39.75 * mm] * 4,
    )
    summary.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("TOPPADDING", (0, 0), (-1, 0), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 0.5 * mm),
                ("TOPPADDING", (0, 1), (-1, 1), 0.5 * mm),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 2.5 * mm),
            ]
        )
    )
    story.extend([KeepTogether([meta, Spacer(1, 3 * mm), summary]), Spacer(1, 5 * mm)])

    table_data: list[list[Any]] = [
        [
            Paragraph("EMPLOYEE", header_style),
            Paragraph("ROLE", header_style),
            Paragraph("STATUS", header_style),
            Paragraph("IN", header_style),
            Paragraph("OUT", header_style),
            Paragraph("NOTES", header_style),
        ]
    ]
    for row in rows:
        table_data.append(
            [
                _paragraph(row.get("employee_name"), cell_bold),
                _paragraph(row.get("employee_role"), cell_style),
                _paragraph(STATUS_LABELS.get(row["status"], row["status"]), cell_bold),
                _paragraph(row.get("check_in"), cell_style),
                _paragraph(row.get("check_out"), cell_style),
                _paragraph(row.get("notes"), note_style),
            ]
        )

    attendance_table = Table(
        table_data,
        colWidths=[35 * mm, 31 * mm, 25 * mm, 15 * mm, 15 * mm, 38 * mm],
        repeatRows=1,
        hAlign="LEFT",
    )
    table_commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("TOPPADDING", (0, 0), (-1, 0), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2.5 * mm),
        ("TOPPADDING", (0, 1), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 2.5 * mm),
    ]
    status_background = {
        "present": PALE_GREEN,
        "remote": PALE_BLUE,
        "leave": PALE_AMBER,
        "sick_leave": PALE_AMBER,
        "absent": PALE_RED,
        "not_recorded": colors.white,
    }
    for index, row in enumerate(rows, start=1):
        if index % 2 == 0:
            table_commands.append(("BACKGROUND", (0, index), (-1, index), ROW_ALT))
        table_commands.append(
            ("BACKGROUND", (2, index), (2, index), status_background.get(row["status"], colors.white))
        )
    attendance_table.setStyle(TableStyle(table_commands))
    story.append(attendance_table)
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "This report reflects the values displayed in TrackerX at export time. Blank times are shown as hyphens.",
            ParagraphStyle(
                "Disclaimer",
                parent=base["Normal"],
                fontName="Helvetica",
                fontSize=7,
                leading=9,
                textColor=MUTED,
                alignment=TA_LEFT,
            ),
        )
    )

    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


def build_monthly_days_off_pdf(
    month: str,
    rows: list[dict[str, Any]],
    prepared_by: str,
) -> bytes:
    """Return a concise monthly employee days-off summary."""

    month_date = datetime.strptime(month, "%Y-%m")
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=20 * mm,
        title=f"TrackerX Monthly Days Off - {month}",
        author=prepared_by,
        subject="Monthly employee days-off report",
    )

    base = getSampleStyleSheet()
    meta_label = ParagraphStyle(
        "MonthlyMetaLabel",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=MUTED,
    )
    meta_value = ParagraphStyle(
        "MonthlyMetaValue",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=INK,
    )
    header_style = ParagraphStyle(
        "MonthlyTableHeader",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    name_style = ParagraphStyle(
        "MonthlyName",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=INK,
    )
    days_style = ParagraphStyle(
        "MonthlyDays",
        parent=name_style,
        alignment=TA_RIGHT,
    )

    story: list[Any] = []
    story.extend([_brand_header("MONTHLY DAYS OFF"), Spacer(1, 5 * mm)])

    total_days_off = sum(int(row["days_off"]) for row in rows)
    meta = Table(
        [
            [
                Paragraph("REPORTING MONTH", meta_label),
                Paragraph("PREPARED BY", meta_label),
                Paragraph("TOTAL DAYS OFF", meta_label),
            ],
            [
                Paragraph(month_date.strftime("%B %Y"), meta_value),
                Paragraph(escape(prepared_by), meta_value),
                Paragraph(str(total_days_off), meta_value),
            ],
        ],
        colWidths=[55 * mm, 65 * mm, 39 * mm],
    )
    meta.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("TOPPADDING", (0, 0), (-1, 0), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 1 * mm),
                ("TOPPADDING", (0, 1), (-1, 1), 1 * mm),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 3 * mm),
            ]
        )
    )
    story.extend([meta, Spacer(1, 5 * mm)])

    report_data: list[list[Any]] = [
        [Paragraph("EMPLOYEE", header_style), Paragraph("DAYS OFF", header_style)]
    ]
    for row in rows:
        report_data.append(
            [
                _paragraph(row.get("employee_name"), name_style),
                _paragraph(row.get("days_off", 0), days_style),
            ]
        )
    report_table = Table(report_data, colWidths=[120 * mm, 39 * mm], repeatRows=1)
    commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]
    for index in range(1, len(report_data)):
        commands.append(
            ("BACKGROUND", (0, index), (-1, index), ROW_ALT if index % 2 == 0 else colors.white)
        )
    report_table.setStyle(TableStyle(commands))
    story.extend([report_table, Spacer(1, 4 * mm)])
    story.append(
        Paragraph(
            "Days off includes Leave, Sick leave, and Absent attendance records saved in TrackerX for this month.",
            ParagraphStyle(
                "MonthlyDefinition",
                parent=base["Normal"],
                fontName="Helvetica",
                fontSize=7,
                leading=9,
                textColor=MUTED,
            ),
        )
    )
    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
