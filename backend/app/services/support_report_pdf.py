from __future__ import annotations

"""Branded, client-ready PDF exports for proactive service reports."""

from datetime import datetime
from html import escape
from io import BytesIO

from reportlab.lib import colors
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
    report_name = "Incident Response Report" if document.title.startswith("Incident Report") else "Service Assurance Report"
    canvas.drawString(18 * mm, 9 * mm, f"blockeXe | {report_name}")
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


def build_incident_report_pdf(incident, prepared_by: str) -> bytes:
    """Return a client-ready incident record separated into incident and response phases."""

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
        title=f"Incident Report - {incident.title}",
        author=prepared_by,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("IncidentTitle", parent=styles["Heading1"], fontName=FONT_BOLD, fontSize=18, leading=22, textColor=INK)
    small = ParagraphStyle("IncidentSmall", parent=styles["Normal"], fontName=FONT_REGULAR, fontSize=7.2, leading=10, textColor=MUTED)
    label_style = ParagraphStyle("IncidentLabel", parent=small, fontName=FONT_BOLD, fontSize=6.7)
    value_style = ParagraphStyle("IncidentValue", parent=small, fontName=FONT_BOLD, fontSize=8.2, textColor=INK)
    section_style = ParagraphStyle("IncidentSection", parent=styles["Heading2"], fontName=FONT_BOLD, fontSize=10, leading=13, textColor=NAVY)
    body_style = ParagraphStyle("IncidentBody", parent=styles["BodyText"], fontName=FONT_REGULAR, fontSize=8, leading=11.5, textColor=INK)
    created = datetime.now().astimezone().strftime("%d %b %Y, %I:%M %p")

    story = [_brand_header("INCIDENT RESPONSE REPORT"), Spacer(1, 6 * mm)]
    heading = Table([[Paragraph(_text(incident.title), title_style), Paragraph(f"<b>Reference</b><br/>INC-{incident.id:04d}<br/><br/><b>Generated</b><br/>{created}", small)]], colWidths=[108 * mm, 51 * mm])
    heading.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("LINEBEFORE", (1,0), (1,0), .7, LINE), ("LEFTPADDING", (0,0), (0,0), 0), ("LEFTPADDING", (1,0), (1,0), 5*mm), ("RIGHTPADDING", (1,0), (1,0), 0)]))
    story.extend([heading, Spacer(1, 5 * mm)])

    detection_label = incident.detection_source.replace("_", " ").title()
    meta = [
        ("PROJECT", incident.project.name),
        ("STATUS", incident.status.replace("_", " ").title()),
        ("SEVERITY", incident.severity.title()),
        ("DETECTED BY", f"{detection_label}{' - ' + incident.reported_by_name if incident.reported_by_name else ''}"),
        ("AFFECTED SERVICE", incident.affected_service or "Not recorded"),
        ("TIME REPORTED", incident.reported_at),
        ("RESPONSE TIME", incident.response_at or "Not recorded"),
    ]
    meta_table = Table([[Paragraph(label, label_style), Paragraph(_text(value), value_style)] for label, value in meta], colWidths=[39 * mm, 120 * mm])
    meta_table.setStyle(TableStyle([("BACKGROUND", (0,0), (0,-1), PALE_BLUE), ("GRID", (0,0), (-1,-1), .45, LINE), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("TOPPADDING", (0,0), (-1,-1), 2*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 2*mm)]))
    story.extend([meta_table, Spacer(1, 5 * mm)])

    phases = [
        ("1. Incident detection and triage", [
            ("Initial report / evidence", incident.client_report),
            ("Description and impact", incident.description),
            ("Suspected cause", incident.reason),
            ("Immediate recommendation", incident.recommendation),
        ]),
        ("2. Response and recovery", [
            ("Containment actions", incident.containment_actions),
            ("Investigation", incident.investigation),
            ("Root cause", incident.root_cause),
            ("Response and recovery actions", incident.response_description),
            ("Recovery validation", incident.recovery_validation),
            ("Resolution notes", incident.resolution_notes),
            ("Lessons learned / prevention", incident.lessons_learned),
        ]),
    ]
    for phase_title, rows in phases:
        story.append(Paragraph(phase_title, section_style))
        story.append(Spacer(1, 2 * mm))
        table_rows = []
        for label, value in rows:
            table_rows.append([Paragraph(label.upper(), label_style), Paragraph(_text(value).replace("\n", "<br/>"), body_style)])
        table = Table(table_rows, colWidths=[48 * mm, 111 * mm], repeatRows=0)
        table.setStyle(TableStyle([("GRID", (0,0), (-1,-1), .45, LINE), ("BACKGROUND", (0,0), (0,-1), PALE_BLUE), ("ROWBACKGROUNDS", (1,0), (1,-1), [colors.white, ROW_ALT]), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 3*mm), ("RIGHTPADDING", (0,0), (-1,-1), 3*mm), ("TOPPADDING", (0,0), (-1,-1), 2.2*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 2.2*mm)]))
        story.extend([table, Spacer(1, 5 * mm)])

    assignees = ", ".join(member.name for member in incident.assignees) or "Unassigned"
    story.extend([Paragraph(f"<b>Response team:</b> {_text(assignees)}", body_style), Paragraph(f"<b>Prepared by:</b> {_text(prepared_by)}", small)])
    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
