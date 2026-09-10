from __future__ import annotations

import logging
"""Build the branded TrackerX daily-attendance PDF."""

from datetime import date, datetime
from html import escape
from io import BytesIO
import os
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
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


logger = logging.getLogger(__name__)


NAVY = colors.HexColor("#0B5279")
INK = colors.HexColor("#142033")
MUTED = colors.HexColor("#667085")
LINE = colors.HexColor("#D9E1EA")
PALE_BLUE = colors.HexColor("#EAF4FA")
PALE_GREEN = colors.HexColor("#EAF8EF")
PALE_AMBER = colors.HexColor("#FFF6E5")
PALE_RED = colors.HexColor("#FDECEF")
ROW_ALT = colors.HexColor("#F8FAFC")
GREEN = colors.HexColor("#14804A")
AMBER = colors.HexColor("#B54708")
COMPANY_LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "blockexe-logo.png"


def _font_candidates() -> list[tuple[Path, Path, int]]:
    """Windows Yu Gothic first, then common Linux/macOS TrueType faces."""

    windir = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    return [
        (windir / "YuGothR.ttc", windir / "YuGothB.ttc", 0),
        (
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            0,
        ),
        (
            Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
            Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
            0,
        ),
        (
            Path("/usr/share/fonts/truetype/freefont/FreeSans.ttf"),
            Path("/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"),
            0,
        ),
        (
            Path("/Library/Fonts/Arial.ttf"),
            Path("/Library/Fonts/Arial Bold.ttf"),
            0,
        ),
    ]


def _register_report_fonts() -> tuple[str, str]:
    """Use Yu Gothic when available, with a safe deployment fallback."""

    registered = set(pdfmetrics.getRegisteredFontNames())
    if "YuGothicTrackerX" in registered and "YuGothicTrackerXBold" in registered:
        return "YuGothicTrackerX", "YuGothicTrackerXBold"

    for regular_path, bold_path, subfont_index in _font_candidates():
        if not regular_path.is_file() or not bold_path.is_file():
            continue
        try:
            if "YuGothicTrackerX" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(
                    TTFont("YuGothicTrackerX", str(regular_path), subfontIndex=subfont_index)
                )
            if "YuGothicTrackerXBold" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(
                    TTFont("YuGothicTrackerXBold", str(bold_path), subfontIndex=subfont_index)
                )
            return "YuGothicTrackerX", "YuGothicTrackerXBold"
        except Exception:
            logger.warning("Could not load attendance PDF font candidate: %s", regular_path)
            continue
    return "Helvetica", "Helvetica-Bold"


FONT_REGULAR, FONT_BOLD = _register_report_fonts()

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
    report_style = ParagraphStyle(
        "HeaderReportTitle",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=10,
        leading=12,
        textColor=INK,
        alignment=TA_CENTER,
    )
    company_logo = PlatypusImage(
        str(COMPANY_LOGO_PATH),
        width=39 * mm,
        height=39 * mm * 872 / 3152,
    )
    company_logo.hAlign = "LEFT"
    header = Table(
        [[company_logo, Paragraph(report_title, report_style), ""]],
        colWidths=[55 * mm, 49 * mm, 55 * mm],
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
    title: str,
    subtitle: str,
    prepared_by: str,
    generated_label: str,
) -> Table:
    base = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportHeading",
        parent=base["Heading1"],
        fontName=FONT_BOLD,
        fontSize=18,
        leading=21,
        textColor=INK,
        spaceAfter=2,
    )
    meta_style = ParagraphStyle(
        "ReportMeta",
        parent=base["Normal"],
        fontName=FONT_REGULAR,
        fontSize=7.2,
        leading=10,
        textColor=MUTED,
        alignment=TA_RIGHT,
    )
    heading = Table(
        [
            [
                Paragraph(f"{escape(title)}<br/><font size='8.5' color='#667085'>{escape(subtitle)}</font>", title_style),
                Paragraph(
                    f"<b>Prepared by</b><br/>{escape(prepared_by)}<br/><br/><b>Generated</b><br/>{escape(generated_label)}",
                    meta_style,
                ),
            ]
        ],
        colWidths=[108 * mm, 51 * mm],
        hAlign="LEFT",
    )
    heading.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 8 * mm),
                ("LEFTPADDING", (1, 0), (1, 0), 5 * mm),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("LINEBEFORE", (1, 0), (1, 0), 0.7, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return heading


def _metric_card(
    label: str,
    value: int,
    background: colors.Color,
    accent: colors.Color,
    width: float = 37.5,
) -> Table:
    base = getSampleStyleSheet()
    label_style = ParagraphStyle(
        f"MetricLabel{label}",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=6.5,
        leading=8,
        textColor=MUTED,
        alignment=TA_CENTER,
    )
    value_style = ParagraphStyle(
        f"MetricValue{label}",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=14,
        leading=16,
        textColor=accent,
        alignment=TA_CENTER,
    )
    card = Table(
        [[Paragraph(label.upper(), label_style)], [Paragraph(str(value), value_style)]],
        colWidths=[width * mm],
    )
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.55, LINE),
                ("LINEABOVE", (0, 0), (-1, 0), 1.6, accent),
                ("TOPPADDING", (0, 0), (-1, 0), 2.2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 0.4 * mm),
                ("TOPPADDING", (0, 1), (-1, 1), 0),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 2.2 * mm),
            ]
        )
    )
    return card


def _footer(canvas: Canvas, document: SimpleDocTemplate) -> None:
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT_REGULAR, 7.5)
    report_name = (
        "Monthly Days Off" if "Monthly Days Off" in document.title else "Daily Attendance"
    )
    canvas.drawString(18 * mm, 9 * mm, f"blockeXe | {report_name}")
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
    cell_style = ParagraphStyle(
        "Cell",
        parent=base["Normal"],
        fontName=FONT_REGULAR,
        fontSize=7.2,
        leading=9.2,
        textColor=INK,
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=cell_style,
        fontName=FONT_BOLD,
    )
    status_style = ParagraphStyle(
        "StatusCell",
        parent=cell_style,
        fontName=FONT_BOLD,
        fontSize=6.8,
        leading=8.5,
        alignment=TA_CENTER,
    )
    header_style = ParagraphStyle(
        "TableHeader",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=6.5,
        leading=8,
        textColor=NAVY,
    )
    note_style = ParagraphStyle(
        "Note",
        parent=cell_style,
        fontSize=7,
        leading=8.5,
        textColor=MUTED,
    )

    story: list[Any] = []
    story.extend(
        [
            _brand_header("DAILY ATTENDANCE"),
            Spacer(1, 7 * mm),
            _report_heading(
                day.strftime("%A, %d %B %Y"),
                "Attendance register with employee IDs and approved leave records",
                prepared_by,
                created.strftime("%d %b %Y, %I:%M %p"),
            ),
            Spacer(1, 6 * mm),
        ]
    )

    total = len(rows)
    on_duty = sum(row["status"] in ("present", "remote") for row in rows)
    away = sum(row["status"] in ("leave", "sick_leave", "absent") for row in rows)
    unrecorded = sum(row["status"] == "not_recorded" for row in rows)
    summary = Table(
        [
            [
                _metric_card("Employees", total, ROW_ALT, NAVY),
                "",
                _metric_card("On duty", on_duty, PALE_GREEN, GREEN),
                "",
                _metric_card("Away", away, PALE_AMBER, AMBER),
                "",
                _metric_card("Unrecorded", unrecorded, ROW_ALT, MUTED),
            ]
        ],
        colWidths=[37.5 * mm, 3 * mm, 37.5 * mm, 3 * mm, 37.5 * mm, 3 * mm, 37.5 * mm],
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
    section_title = ParagraphStyle(
        "DailySectionTitle",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=10,
        leading=12,
        textColor=INK,
    )
    section_meta = ParagraphStyle(
        "DailySectionMeta",
        parent=base["Normal"],
        fontName=FONT_REGULAR,
        fontSize=7,
        leading=9,
        textColor=MUTED,
        alignment=TA_RIGHT,
    )
    section_heading = Table(
        [[Paragraph("Employee attendance", section_title), Paragraph(f"{total} employees", section_meta)]],
        colWidths=[120 * mm, 39 * mm],
    )
    section_heading.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ]
        )
    )
    story.extend([KeepTogether([summary]), Spacer(1, 7 * mm), section_heading])

    table_data: list[list[Any]] = [
        [
            Paragraph("ID", header_style),
            Paragraph("EMPLOYEE", header_style),
            Paragraph("ROLE", header_style),
            Paragraph("ATTENDANCE", header_style),
            Paragraph("CHECK IN", header_style),
            Paragraph("CHECK OUT", header_style),
            Paragraph("NOTE", header_style),
        ]
    ]
    for row in rows:
        table_data.append(
            [
                _paragraph(row.get("employee_number"), cell_bold),
                _paragraph(row.get("employee_name"), cell_bold),
                _paragraph(row.get("employee_role"), cell_style),
                _paragraph(STATUS_LABELS.get(row["status"], row["status"]), status_style),
                _paragraph(row.get("check_in"), cell_style),
                _paragraph(row.get("check_out"), cell_style),
                _paragraph(row.get("notes"), note_style),
            ]
        )

    attendance_table = Table(
        table_data,
        colWidths=[15 * mm, 28 * mm, 27 * mm, 23 * mm, 17 * mm, 17 * mm, 32 * mm],
        repeatRows=1,
        hAlign="LEFT",
    )
    table_commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), PALE_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("TOPPADDING", (0, 0), (-1, 0), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3 * mm),
        ("TOPPADDING", (0, 1), (-1, -1), 3.2 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3.2 * mm),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (3, 0), (5, -1), "CENTER"),
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
        table_commands.append(("LINEBELOW", (0, index), (-1, index), 0.35, LINE))
        table_commands.append(
            ("BACKGROUND", (3, index), (3, index), status_background.get(row["status"], colors.white))
        )
    attendance_table.setStyle(TableStyle(table_commands))
    story.append(attendance_table)
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "Generated from the saved attendance record. Times use the local office time zone.",
            ParagraphStyle(
                "Disclaimer",
                parent=base["Normal"],
                fontName=FONT_REGULAR,
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
    created = datetime.now().astimezone()
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
    header_style = ParagraphStyle(
        "MonthlyTableHeader",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=7,
        leading=9,
        textColor=NAVY,
    )
    name_style = ParagraphStyle(
        "MonthlyName",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=8.2,
        leading=10,
        textColor=INK,
    )
    days_style = ParagraphStyle(
        "MonthlyDays",
        parent=name_style,
        alignment=TA_RIGHT,
    )

    story: list[Any] = []
    total_days_off = sum(int(row["days_off"]) for row in rows)
    employees_with_days_off = sum(int(row["days_off"]) > 0 for row in rows)
    story.extend(
        [
            _brand_header("MONTHLY DAYS OFF"),
            Spacer(1, 7 * mm),
            _report_heading(
                month_date.strftime("%B %Y"),
                "Leave and absence summary by employee ID",
                prepared_by,
                created.strftime("%d %b %Y, %I:%M %p"),
            ),
            Spacer(1, 6 * mm),
        ]
    )
    summary = Table(
        [
            [
                _metric_card("Employees", len(rows), ROW_ALT, NAVY, width=51),
                "",
                _metric_card("With days off", employees_with_days_off, PALE_AMBER, AMBER, width=51),
                "",
                _metric_card("Total days off", total_days_off, PALE_BLUE, NAVY, width=51),
            ]
        ],
        colWidths=[51 * mm, 3 * mm, 51 * mm, 3 * mm, 51 * mm],
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
    section_title = ParagraphStyle(
        "MonthlySectionTitle",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=10,
        leading=12,
        textColor=INK,
    )
    section_meta = ParagraphStyle(
        "MonthlySectionMeta",
        parent=base["Normal"],
        fontName=FONT_REGULAR,
        fontSize=7,
        leading=9,
        textColor=MUTED,
        alignment=TA_RIGHT,
    )
    section_heading = Table(
        [[Paragraph("Days off by employee", section_title), Paragraph(f"{len(rows)} employees", section_meta)]],
        colWidths=[120 * mm, 39 * mm],
    )
    section_heading.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ]
        )
    )
    story.extend([summary, Spacer(1, 7 * mm), section_heading])

    report_data: list[list[Any]] = [
        [
            Paragraph("ID", header_style),
            Paragraph("EMPLOYEE", header_style),
            Paragraph("ROLE", header_style),
            Paragraph("DAYS OFF", header_style),
        ]
    ]
    for row in rows:
        report_data.append(
            [
                _paragraph(row.get("employee_number"), name_style),
                _paragraph(row.get("employee_name"), name_style),
                _paragraph(row.get("employee_role"), name_style),
                _paragraph(row.get("days_off", 0), days_style),
            ]
        )
    report_table = Table(report_data, colWidths=[20 * mm, 61 * mm, 57 * mm, 21 * mm], repeatRows=1)
    commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), PALE_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, 0), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3 * mm),
        ("TOPPADDING", (0, 1), (-1, -1), 3.4 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3.4 * mm),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (3, 0), (3, -1), "CENTER"),
    ]
    for index, row in enumerate(rows, start=1):
        commands.append(
            ("BACKGROUND", (0, index), (-1, index), ROW_ALT if index % 2 == 0 else colors.white)
        )
        commands.append(("LINEBELOW", (0, index), (-1, index), 0.35, LINE))
        if int(row["days_off"]) > 0:
            commands.append(("BACKGROUND", (3, index), (3, index), PALE_AMBER))
    report_table.setStyle(TableStyle(commands))
    story.extend([report_table, Spacer(1, 4 * mm)])
    story.append(
        Paragraph(
            "Days off includes Leave, Sick leave, and Absent attendance records saved for this month.",
            ParagraphStyle(
                "MonthlyDefinition",
                parent=base["Normal"],
                fontName=FONT_REGULAR,
                fontSize=7,
                leading=9,
                textColor=MUTED,
            ),
        )
    )
    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
