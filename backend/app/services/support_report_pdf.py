from __future__ import annotations

"""Branded, client-ready PDF exports for proactive service reports."""

from datetime import datetime
from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.attendance_pdf import (
    FONT_BOLD,
    FONT_REGULAR,
    INK,
    LINE,
    MUTED,
    NAVY,
    PALE_BLUE,
    ROW_ALT,
    _brand_header,
)


CATEGORY_LABELS = {
    "health_check": "Health Check",
    "patch_update": "Patch Update",
    "penetration_testing": "Penetration Testing",
    "updates": "System Updates",
    "performance": "Performance",
    "kpi": "KPI",
}


def _footer(canvas: Canvas, document: SimpleDocTemplate) -> None:
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont(FONT_REGULAR, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "blockeXe | Service Assurance Report")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def _text(value: object | None) -> str:
    return escape(str(value).strip()) if value is not None and str(value).strip() else "Not recorded"


def build_proactive_report_pdf(report, prepared_by: str) -> bytes:
    """Return a Yu Gothic, BlockeXe-branded PDF for one proactive report."""

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
        title=f"Service Assurance Report - {report.title}",
        author=prepared_by,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ServiceTitle", parent=styles["Heading1"], fontName=FONT_BOLD, fontSize=18, leading=22, textColor=INK)
    subtitle_style = ParagraphStyle("ServiceSubtitle", parent=styles["Normal"], fontName=FONT_REGULAR, fontSize=8, leading=11, textColor=MUTED)
    meta_label = ParagraphStyle("MetaLabel", parent=subtitle_style, fontName=FONT_BOLD, fontSize=6.7, textColor=MUTED)
    meta_value = ParagraphStyle("MetaValue", parent=subtitle_style, fontName=FONT_BOLD, fontSize=8.2, textColor=INK)
    section_title = ParagraphStyle("SectionTitle", parent=styles["Heading2"], fontName=FONT_BOLD, fontSize=9.5, leading=12, textColor=NAVY)
    body = ParagraphStyle("ServiceBody", parent=styles["BodyText"], fontName=FONT_REGULAR, fontSize=8.2, leading=12.2, textColor=INK)
    small = ParagraphStyle("ServiceSmall", parent=body, fontSize=7.2, leading=10, textColor=MUTED)

    service_area = report.service_area_name or CATEGORY_LABELS.get(report.category, report.category.replace("_", " ").title())
    created = datetime.now().astimezone().strftime("%d %b %Y, %I:%M %p")
    story = [_brand_header("SERVICE ASSURANCE REPORT"), Spacer(1, 7 * mm)]
    heading = Table([[Paragraph(_text(report.title), title_style), Paragraph(f"<b>Reference</b><br/>PR-{report.id:04d}<br/><br/><b>Generated</b><br/>{created}", small)]], colWidths=[108 * mm, 51 * mm])
    heading.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("LINEBEFORE", (1,0), (1,0), .7, LINE), ("LEFTPADDING", (0,0), (0,0), 0), ("LEFTPADDING", (1,0), (1,0), 5*mm), ("RIGHTPADDING", (1,0), (1,0), 0)]))
    story.extend([heading, Spacer(1, 6 * mm)])

    meta = [
        ("PROJECT", report.project.name),
        ("SERVICE AREA", service_area),
        ("STATUS", report.status.replace("_", " ").title()),
        ("REPORTING PERIOD", f"{report.period_start or 'Not recorded'} — {report.period_end or 'Not recorded'}"),
        ("DUE DATE", report.due_date or "Not recorded"),
        ("NEXT ACTION", report.next_action_date or "Not recorded"),
    ]
    meta_cells = [[Paragraph(label, meta_label), Paragraph(_text(value), meta_value)] for label, value in meta]
    meta_table = Table(meta_cells, colWidths=[39 * mm, 120 * mm])
    meta_table.setStyle(TableStyle([("BACKGROUND", (0,0), (0,-1), PALE_BLUE), ("BACKGROUND", (1,0), (1,-1), colors.white), ("GRID", (0,0), (-1,-1), .45, LINE), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("TOPPADDING", (0,0), (-1,-1), 2.4*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 2.4*mm)]))
    story.extend([meta_table, Spacer(1, 7 * mm)])

    for index, (label, value) in enumerate((
        ("Executive summary", report.executive_summary),
        ("Findings and evidence", report.findings),
        ("Work completed", report.work_completed),
        ("Recommendations and next steps", report.recommendations),
    )):
        section = Table([[Paragraph(label.upper(), section_title)], [Paragraph(_text(value).replace("\n", "<br/>"), body)]], colWidths=[159 * mm])
        section.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), PALE_BLUE), ("BACKGROUND", (0,1), (-1,1), colors.white if index % 2 == 0 else ROW_ALT), ("BOX", (0,0), (-1,-1), .55, LINE), ("LEFTPADDING", (0,0), (-1,-1), 4*mm), ("RIGHTPADDING", (0,0), (-1,-1), 4*mm), ("TOPPADDING", (0,0), (-1,0), 2.5*mm), ("BOTTOMPADDING", (0,0), (-1,0), 2*mm), ("TOPPADDING", (0,1), (-1,1), 3*mm), ("BOTTOMPADDING", (0,1), (-1,1), 3*mm)]))
        story.extend([section, Spacer(1, 3.5 * mm)])

    assignees = ", ".join(member.name for member in report.assignees) or "Unassigned"
    story.extend([Spacer(1, 2 * mm), Paragraph(f"<b>Assigned team:</b> {_text(assignees)}", body), Paragraph(f"<b>Prepared by:</b> {_text(prepared_by)}", small)])
    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
