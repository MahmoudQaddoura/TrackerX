"""Build the branded TrackerX security and reliability remediation audit PDF."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "TrackerX-Security-Reliability-Remediation-Audit-2026-09-10.pdf"
LOGO = ROOT / "frontend" / "public" / "x.png"

NAVY = colors.HexColor("#07537D")
DARK_NAVY = colors.HexColor("#092F49")
INK = colors.HexColor("#102033")
MUTED = colors.HexColor("#5D6C7D")
CYAN = colors.HexColor("#E8F5FC")
PALE = colors.HexColor("#F5F8FB")
LINE = colors.HexColor("#D8E3EC")
GREEN = colors.HexColor("#14804A")
GREEN_BG = colors.HexColor("#E8F6EE")
AMBER = colors.HexColor("#A86100")
AMBER_BG = colors.HexColor("#FFF4DE")
RED = colors.HexColor("#B3261E")
WHITE = colors.white


def register_fonts() -> tuple[str, str]:
    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/calibri.ttf"),
    ]
    bold_candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/calibrib.ttf"),
    ]
    regular = "Helvetica"
    bold = "Helvetica-Bold"
    for path in candidates:
        if path.exists():
            pdfmetrics.registerFont(TTFont("TrackerRegular", str(path)))
            regular = "TrackerRegular"
            break
    for path in bold_candidates:
        if path.exists():
            pdfmetrics.registerFont(TTFont("TrackerBold", str(path)))
            bold = "TrackerBold"
            break
    return regular, bold


REGULAR, BOLD = register_fonts()
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodyX", fontName=REGULAR, fontSize=9.2, leading=13.2, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallX", fontName=REGULAR, fontSize=7.6, leading=10.2, textColor=MUTED))
styles.add(ParagraphStyle(name="TinyX", fontName=REGULAR, fontSize=6.7, leading=8.4, textColor=MUTED))
styles.add(ParagraphStyle(name="H1X", fontName=BOLD, fontSize=21, leading=25, textColor=DARK_NAVY, spaceAfter=7))
styles.add(ParagraphStyle(name="H2X", fontName=BOLD, fontSize=13.5, leading=17, textColor=NAVY, spaceBefore=6, spaceAfter=6))
styles.add(ParagraphStyle(name="H3X", fontName=BOLD, fontSize=10.5, leading=13, textColor=INK, spaceBefore=5, spaceAfter=3))
styles.add(ParagraphStyle(name="WhiteTitle", fontName=BOLD, fontSize=29, leading=34, textColor=WHITE))
styles.add(ParagraphStyle(name="WhiteSub", fontName=REGULAR, fontSize=12.5, leading=18, textColor=colors.HexColor("#DDEEF7")))
styles.add(ParagraphStyle(name="Label", fontName=BOLD, fontSize=7.4, leading=9, textColor=MUTED, spaceAfter=2))
styles.add(ParagraphStyle(name="Metric", fontName=BOLD, fontSize=17, leading=20, textColor=NAVY))
styles.add(ParagraphStyle(name="Status", fontName=BOLD, fontSize=8, leading=10, textColor=GREEN, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="TableHead", fontName=BOLD, fontSize=7.2, leading=9, textColor=WHITE))
styles.add(ParagraphStyle(name="TableCell", fontName=REGULAR, fontSize=7, leading=9.2, textColor=INK))
styles.add(ParagraphStyle(name="TableCellBold", fontName=BOLD, fontSize=7.1, leading=9.2, textColor=INK))
styles.add(ParagraphStyle(name="Footer", fontName=REGULAR, fontSize=7, leading=8, textColor=MUTED))


def p(text: str, style: str = "BodyX") -> Paragraph:
    return Paragraph(text, styles[style])


def bullet(text: str) -> Paragraph:
    return Paragraph(f"<font color='#07537D'>\u2022</font>&nbsp;&nbsp;{text}", styles["BodyX"])


def section_title(number: str, title: str, subtitle: str | None = None) -> list:
    block = [
        Table(
            [[p(number, "Status"), p(title, "H2X")]],
            colWidths=[13 * mm, 160 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), CYAN),
                    ("BOX", (0, 0), (0, 0), 0.6, colors.HexColor("#B9DCEB")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (0, 0), 3),
                    ("RIGHTPADDING", (0, 0), (0, 0), 3),
                    ("LEFTPADDING", (1, 0), (1, 0), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            ),
        )
    ]
    if subtitle:
        block.extend([Spacer(1, 2 * mm), p(subtitle, "SmallX")])
    block.append(Spacer(1, 2.5 * mm))
    return block


def metric_card(label: str, value: str, note: str, accent=CYAN) -> Table:
    return Table(
        [[p(label.upper(), "Label")], [p(value, "Metric")], [p(note, "SmallX")]],
        colWidths=[40 * mm],
        rowHeights=[6 * mm, 9 * mm, 12 * mm],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), accent),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        ),
    )


def evidence_table(rows: list[tuple[str, str]], widths=(61 * mm, 112 * mm)) -> Table:
    data = [[p("CONTROL", "TableHead"), p("VERIFIED RESULT", "TableHead")]]
    for left, right in rows:
        data.append([p(left, "TableCellBold"), p(right, "TableCell")])
    table = Table(data, colWidths=list(widths), repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def finding_table(rows: list[tuple[str, str, str, str]]) -> Table:
    data = [[p("ID / RISK", "TableHead"), p("FINDING", "TableHead"), p("REMEDIATION AND VERIFIED EVIDENCE", "TableHead"), p("STATUS", "TableHead")]]
    for identifier, risk, finding, remediation in rows:
        risk_color = {"Critical": RED, "High": RED, "Medium": AMBER}.get(risk, NAVY)
        data.append(
            [
                Paragraph(f"<b>{identifier}</b><br/><font color='{risk_color.hexval()}'>{risk}</font>", styles["TableCell"]),
                p(finding, "TableCell"),
                p(remediation, "TableCell"),
                p("CLOSED", "Status"),
            ]
        )
    table = Table(data, colWidths=[24 * mm, 52 * mm, 83 * mm, 17 * mm], repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BACKGROUND", (-1, 1), (-1, -1), GREEN_BG),
            ]
        )
    )
    return table


class AuditDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=20 * mm,
            bottomMargin=17 * mm,
            title="TrackerX Security and Reliability Remediation Audit",
            author="TrackerX Engineering",
            subject="Production security, reliability, database, and API audit with remediation",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        cover_frame = Frame(0, 0, A4[0], A4[1], leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0, id="cover")
        self.addPageTemplates(
            [
                PageTemplate(id="cover", frames=cover_frame, onPage=self._cover_page),
                PageTemplate(id="body", frames=frame, onPage=self._body_page),
            ]
        )

    def afterPage(self):
        if self.page == 1:
            self.handle_nextPageTemplate("body")

    def _cover_page(self, canvas, _doc):
        width, height = A4
        canvas.saveState()
        canvas.setFillColor(DARK_NAVY)
        canvas.rect(0, 0, width, height, fill=1, stroke=0)
        canvas.setFillColor(NAVY)
        canvas.circle(width + 5 * mm, height - 25 * mm, 77 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#176E99"))
        canvas.circle(width + 8 * mm, height - 26 * mm, 47 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#0F87B8"))
        canvas.rect(0, 0, width, 8 * mm, fill=1, stroke=0)
        canvas.restoreState()

    def _body_page(self, canvas, _doc):
        width, height = A4
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(18 * mm, height - 13 * mm, width - 18 * mm, height - 13 * mm)
        if LOGO.exists():
            canvas.drawImage(str(LOGO), 18 * mm, height - 11.5 * mm, width=5.5 * mm, height=5.5 * mm, mask="auto", preserveAspectRatio=True)
        canvas.setFont(BOLD, 7.5)
        canvas.setFillColor(DARK_NAVY)
        canvas.drawString(25 * mm, height - 9.7 * mm, "TRACKERX")
        canvas.setFont(REGULAR, 7)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(width - 18 * mm, height - 9.7 * mm, "SECURITY + RELIABILITY REMEDIATION AUDIT")
        canvas.line(18 * mm, 12 * mm, width - 18 * mm, 12 * mm)
        canvas.setFont(REGULAR, 7)
        canvas.drawString(18 * mm, 7.5 * mm, "CONFIDENTIAL - INTERNAL CONTROL RECORD")
        canvas.drawRightString(width - 18 * mm, 7.5 * mm, f"10 SEP 2026   |   PAGE {self.page}")
        canvas.restoreState()


def build_story() -> list:
    story: list = []
    story.extend(
        [
            Spacer(1, 35 * mm),
            Image(str(LOGO), width=24 * mm, height=24 * mm),
            Spacer(1, 8 * mm),
            Paragraph("TRACKERX", ParagraphStyle("CoverBrand", parent=styles["WhiteSub"], fontName=BOLD, fontSize=13, leading=15, tracking=2)),
            Spacer(1, 17 * mm),
            p("SECURITY & RELIABILITY", "WhiteTitle"),
            p("REMEDIATION AUDIT", "WhiteTitle"),
            Spacer(1, 7 * mm),
            Paragraph("Production code, API, database, dependency, host, and availability assessment", styles["WhiteSub"]),
            Spacer(1, 20 * mm),
            Table(
                [
                    [p("AUDIT DATE", "TableHead"), p("10 September 2026", "WhiteSub")],
                    [p("PRODUCTION", "TableHead"), p("trackerx.defendexe.com", "WhiteSub")],
                    [p("ASSESSMENT", "TableHead"), p("Audit with concurrent remediation", "WhiteSub")],
                    [p("VERDICT", "TableHead"), Paragraph("READY - CONTROLLED SINGLE-HOST DEPLOYMENT", ParagraphStyle("CoverVerdict", parent=styles["WhiteSub"], fontName=BOLD, textColor=colors.HexColor("#8BE6B4")))],
                ],
                colWidths=[35 * mm, 125 * mm],
                style=TableStyle(
                    [
                        ("LINEBELOW", (0, 0), (-1, -1), 0.35, colors.HexColor("#4A7892")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 7),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ]
                ),
            ),
            Spacer(1, 33 * mm),
            Paragraph("Prepared for production deployment and operational handoff", styles["WhiteSub"]),
            PageBreak(),
        ]
    )

    story += section_title("01", "Executive verdict", "A direct statement of current production readiness and the limits of this assessment.")
    story += [
        Table(
            [[Paragraph("READY", ParagraphStyle("Ready", fontName=BOLD, fontSize=20, leading=23, textColor=GREEN)), p("All confirmed critical and high-risk findings discovered during this audit were remediated and re-tested. Production passed database integrity, API stability, dependency, transport, host, backup, and recovery checks.", "BodyX")]],
            colWidths=[37 * mm, 137 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), GREEN_BG),
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#A8D8BD")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            ),
        ),
        Spacer(1, 6 * mm),
        Table(
            [[metric_card("Findings closed", "14 / 14", "Confirmed audit findings", GREEN_BG), metric_card("API operations", "112", "No unauthenticated 500s"), metric_card("Automated tests", "50 / 50", "Passed in isolated data paths"), metric_card("Host hardening", "2.8 OK", "From 7.6 EXPOSED", GREEN_BG)]],
            colWidths=[43.5 * mm] * 4,
            style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 1.2), ("RIGHTPADDING", (0, 0), (-1, -1), 1.2)]),
        ),
        Spacer(1, 7 * mm),
        p("What changed", "H2X"),
        bullet("Seven accounts using the prior shared demo password were rotated to unique temporary credentials; existing sessions were revoked and password change is mandatory."),
        bullet("SSH now accepts keys only, rejects root/password login, and limits authentication attempts. The firewall allows only SSH, HTTP, and HTTPS."),
        bullet("Production refuses an unexpected or incomplete database; readiness validates schema, users, integrity, and object storage."),
        bullet("A verified daily backup timer and a one-minute application readiness/recovery timer now supplement process restart controls."),
        bullet("The backend systemd sandbox now has no Linux capabilities and only writes to the required data and backup directories."),
        Spacer(1, 4 * mm),
        Table(
            [[p("IMPORTANT LIMIT", "TableCellBold"), p("This is not a promise of absolute uptime or an independent certification. TrackerX still runs on a single host with SQLite. Host, datacenter, DNS, or upstream network failure can interrupt service; the prioritized architecture controls are listed on page 8.", "TableCell")]],
            colWidths=[34 * mm, 140 * mm],
            style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), AMBER_BG), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#EACB8A")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]),
        ),
        PageBreak(),
    ]

    story += section_title("02", "Scope and audit method", "Evidence was gathered from source, tests, the live application, host controls, and a read-only production database audit.")
    story += [
        evidence_table(
            [
                ("Backend source", "11,447 lines of Python application code; authentication, authorization, validation, file handling, exports, and error paths."),
                ("API surface", "81 OpenAPI paths and 112 unique method/path operations; full unauthenticated failure sweep."),
                ("Database", "SQLite schema completeness, quick check, foreign keys, account constraints, duplicates, compromised-password detection, permissions, and backup recovery."),
                ("Dependencies", "Python runtime/development packages and JavaScript dependency graph checked against published advisories."),
                ("Infrastructure", "TLS, headers, listening ports, SSH, firewall, systemd isolation, restart behavior, recovery, timers, disk, and memory."),
                ("Frontend", "TypeScript validation, Vite production build, route-level splitting, and generated asset sizes."),
            ]
        ),
        Spacer(1, 7 * mm),
        p("Reference-document boundary", "H2X"),
        p("The supplied AI Tutor security and engineering audit reports were used as a checklist and presentation reference only. They concern another product. LLM, RAG, prompt-injection, and vector-store findings are not applicable because TrackerX contains none of those components."),
        Spacer(1, 5 * mm),
        p("Severity and closure standard", "H2X"),
        bullet("Critical: practical account, data, or host compromise with material impact."),
        bullet("High: strong security, integrity, or availability impact requiring release-blocking remediation."),
        bullet("Medium: defense-in-depth or resilience weakness that meaningfully raises operational risk."),
        bullet("Closed: code or configuration changed, the control was deployed, and relevant verification succeeded."),
        Spacer(1, 4 * mm),
        p("Audit approach", "H2X"),
        p("The review combined static analysis, dependency analysis, targeted source tracing, isolated automated tests, production-safe API requests, host inspection, read-only database inspection, controlled service restart checks, and verified backup creation. Secrets and password hashes were not copied into this report."),
        PageBreak(),
    ]

    findings = [
        ("TX-26-01", "Critical", "Seven production accounts matched the shared demo password.", "Created a verified pre-change backup; assigned unique random temporary passwords; incremented auth_version; required password change. Re-audit: 0 matches."),
        ("TX-26-02", "High", "SSH permitted password authentication and direct root login.", "Installed key-only policy; disabled root/password/interactive login; set MaxAuthTries 3; sshd configuration and fresh key session passed."),
        ("TX-26-03", "High", "Database and backup paths had overbroad modes.", "Data and backup directories are 700; database, environment, archives, and rotation file are 600."),
        ("TX-26-04", "High", "Demo/sample data commands were not production-safe.", "Commands now fail closed in production; built-in demo password removed; explicit policy-compliant local value required."),
        ("TX-26-05", "Medium", "Office previews used the standard XML parser.", "Moved to defusedxml and added malicious DTD/entity expansion regression coverage."),
        ("TX-26-06", "High", "Health only proved a trivial database query.", "Readiness now verifies all required tables, a production user, SQLite quick_check, and object storage; startup blocks wrong/incomplete production databases."),
        ("TX-26-07", "Medium", "Backups occurred only on application startup.", "Added persistent daily systemd timer, integrity/checksum verification, and retention of 14 newest archives."),
    ]
    story += section_title("03", "Findings and remediation", "Every confirmed finding was fixed during the audit and re-tested against the affected control.")
    story += [finding_table(findings), PageBreak()]
    findings_2 = [
        ("TX-26-08", "Medium", "No application-level recovery loop existed.", "Added one-minute readiness timer and controlled recovery unit; failure triggers restart only after bounded retries."),
        ("TX-26-09", "Medium", "SQLite used default concurrency and relationship settings.", "Enabled WAL, foreign keys, 30-second busy timeout, normal synchronous mode, connection pre-ping, and PRAGMA optimize."),
        ("TX-26-10", "Medium", "Failures lacked a stable support reference.", "Added X-Request-ID; database outages return 503 with Retry-After; unexpected errors return a stable ID and retain server traceback."),
        ("TX-26-11", "High", "Test import order could select production data before isolation.", "Safe runner selects disposable database/document/backup paths before imports and disposes handles afterward; CI uses it."),
        ("TX-26-12", "Medium", "Initial JavaScript bundle was 759 KB.", "Route-level lazy loading reduced main bundle to 270.12 KB (90.03 KB gzip); largest route chunk 219.10 KB."),
        ("TX-26-13", "Medium", "Host firewall was inactive.", "Enabled default-deny inbound firewall with only TCP 22, 80, and 443 allowed; backend/storage/database remain loopback-only."),
        ("TX-26-14", "Medium", "Health timer could race application startup.", "Added bounded connection retries and proved controlled restart plus immediate probe; result is success without redundant recovery."),
    ]
    story += section_title("03", "Findings and remediation - continued")
    story += [finding_table(findings_2), Spacer(1, 7 * mm)]
    story += [p("Credential remediation safeguard", "H2X"), p("The rotation output exists only on the server in an owner-readable file. This report deliberately excludes temporary credentials and password hashes. Each account holder must receive only their own credential and complete the forced password change."), PageBreak()]

    story += section_title("04", "Application and API security", "Controls are assessed by outcome across authentication, authorization, injection resistance, files, and browser boundaries.")
    security_blocks = [
        ("Authentication and sessions", [
            "Bcrypt password hashing; 12-to-72-byte policy; three character classes; common, repeated, and identity-derived passwords rejected.",
            "Secure, HttpOnly, SameSite=Strict cookies in production; JWT issuer, audience, algorithm, expiry, issued-at, subject, token ID, and authorization version validated.",
            "Sensitive access changes revoke sessions. Login enumeration is limited and throttling returns 429 with Retry-After.",
        ]),
        ("Authorization and portal boundaries", [
            "Owner/admin controls, project-manager scope, employee membership, and client disclosure are enforced in reusable backend dependencies.",
            "Clients receive only linked projects and reports explicitly forwarded to them; profile/CV files remain private to employee and administrators.",
            "Project managers assign tasks only inside managed rosters; leave approval routes employees to PM/admin and PM/admin to owner.",
        ]),
        ("Injection, input, and uploads", [
            "User-controlled database values use SQLAlchemy expressions or bound parameters; no user-controlled SQL fragment or identifier was found.",
            "Storage keys reject absolute paths, traversal, empty segments, and backslashes. Uploads enforce size, count, extension, filename, and empty-file limits with rollback.",
            "Office archives cap total unpacked size at 30 MB and reject dangerous XML entities/DTDs; risky active formats render as plain text.",
        ]),
        ("Transport and browser", [
            "Caddy terminates TLS and redirects HTTP. HSTS, CSP, DENY framing, nosniff, referrer, permissions, COOP, CORP, no-store, and request-ID headers are active.",
            "CORS and trusted hosts are explicit. Production OpenAPI documentation returns 404. Non-public services bind only to loopback.",
        ]),
    ]
    for title, items in security_blocks:
        story.append(KeepTogether([p(title, "H3X"), *[bullet(item) for item in items]]))
        story.append(Spacer(1, 2 * mm))
    story += [PageBreak()]

    story += section_title("05", "Database security and integrity", "The live audit utility opened SQLite read-only and reported control outcomes without copying credentials or hashes.")
    story += [
        evidence_table(
            [
                ("Environment", "production"),
                ("SQLite quick check", "ok"),
                ("Foreign-key violations", "0"),
                ("Schema", "26 tables; all required application tables present"),
                ("Accounts", "14 total; 10 enabled; exactly 1 enabled primary owner/admin"),
                ("Identity/state constraints", "0 duplicate case-insensitive emails; 0 invalid role, access, or enabled states"),
                ("Compromised-password matches", "0 after rotation"),
                ("Filesystem permissions", "Data/database: 700/600; backups/archives: 700/600; environment file: 600"),
                ("SQLite runtime controls", "WAL; foreign keys per connection; 30-second busy timeout; connection pre-ping"),
            ]
        ),
        Spacer(1, 7 * mm),
        p("SQL injection assessment", "H2X"),
        p("All user-controlled query values reviewed use SQLAlchemy expression binding or explicit bound parameters. Remaining direct driver and SQLite statements are fixed schema migrations, static maintenance statements, or parameterized operations. No reachable path was found where a user controls a SQL identifier, operator, ordering expression, or raw clause."),
        Spacer(1, 5 * mm),
        p("Backup assurance", "H2X"),
        bullet("SQLite online backup prevents an inconsistent copy while writes occur."),
        bullet("Every archive receives database integrity validation, SHA-256 entry checksums, and document manifest coverage."),
        bullet("Verified pre-remediation, scheduled, and startup backups exist with owner-only permissions."),
        PageBreak(),
    ]

    story += section_title("06", "Availability and operational resilience", "Layered detection and recovery now cover process failure, application readiness, reboot gaps, and routine data recovery.")
    story += [
        evidence_table(
            [
                ("Public readiness", "HTTP 200 in 0.039 seconds; status, database, schema, integrity, and storage all ok"),
                ("Process liveness", "/api/health/live available separately from full dependency readiness"),
                ("Recovery loop", "One-minute systemd timer; restart only after bounded retries fail"),
                ("Backups", "Persistent daily timer; startup backup; retention of 14 newest archives"),
                ("Service isolation", "No capabilities; strict filesystem; private devices/temp; restricted process, namespace, address-family, and system-call exposure"),
                ("systemd exposure", "2.8 OK after hardening, improved from 7.6 EXPOSED"),
                ("Network surface", "Public TCP 22/80/443 only; API, database, and object storage on loopback"),
                ("Capacity snapshot", "Approximately 10 GiB available memory; 186 GiB disk free; 4% disk used"),
            ]
        ),
        Spacer(1, 7 * mm),
        p("Request-failure behavior", "H2X"),
        p("Database operational faults are classified as temporary dependency failures and return HTTP 503 plus Retry-After. Unexpected application errors return a stable request ID instead of leaking internals. The same request ID is present in server logs and the response, making production incidents traceable without exposing stack details."),
        Spacer(1, 5 * mm),
        Table(
            [[p("SINGLE-HOST REALITY", "TableCellBold"), p("The controls above materially reduce downtime and speed recovery, but they cannot make one server always available. Independent uptime requires redundant instances and replicated external data services.", "TableCell")]],
            colWidths=[38 * mm, 136 * mm],
            style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), AMBER_BG), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#EACB8A")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]),
        ),
        PageBreak(),
    ]

    story += section_title("07", "Verification record", "Release gates were rerun after remediation; production-only controls were validated on the live host.")
    story += [
        evidence_table(
            [
                ("Backend tests", "50 / 50 passed"),
                ("API failure sweep", "112 operations; no unauthenticated HTTP 500 responses"),
                ("OpenAPI uniqueness", "112 unique method/path operations"),
                ("Ruff", "Passed"),
                ("Bandit", "11,447 application lines; 0 low, medium, or high findings"),
                ("Python dependency audit", "No known vulnerabilities"),
                ("npm audit", "0 vulnerabilities"),
                ("Python compilation", "Passed"),
                ("Frontend", "TypeScript validation and Vite production build passed"),
                ("Public controls", "Readiness 200; security headers verified; production OpenAPI 404"),
                ("Operational drills", "Immediate verified backup, controlled restart, readiness retry, and fresh SSH key session passed"),
            ]
        ),
        Spacer(1, 7 * mm),
        p("Release decision", "H2X"),
        Table(
            [[Paragraph("APPROVED", ParagraphStyle("Approved", fontName=BOLD, fontSize=15, leading=18, textColor=GREEN, alignment=TA_CENTER)), p("Approved for the current controlled single-host production model, subject to the credential handoff and residual-risk roadmap on the next page.", "BodyX")]],
            colWidths=[41 * mm, 133 * mm],
            style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), GREEN_BG), ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#A8D8BD")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]),
        ),
        PageBreak(),
    ]

    story += section_title("08", "Residual risk and prioritized roadmap", "These are architecture or external-service limits, not hidden exceptions to the remediated findings.")
    residual = [
        ("P0", "Credential handoff", "Privately deliver each temporary password, require the first-login change, then securely delete the server rotation file."),
        ("P1", "Off-server recovery", "Copy encrypted backups off-host, define recovery objectives, and prove restoration through scheduled drills."),
        ("P1", "Independent monitoring", "Monitor the public HTTPS endpoint from outside the server and alert on sustained failure and recovery."),
        ("P1", "High availability", "Migrate SQLite to managed PostgreSQL, replicate object storage, and run at least two API instances behind the proxy."),
        ("P1", "Privileged MFA", "Add WebAuthn or TOTP for owner, admin, and project-manager accounts."),
        ("P2", "Shared throttling", "Move rate-limit state to Redis before horizontal scaling."),
        ("P2", "Upload malware scanning", "Add quarantine and antivirus scanning when files come from broadly untrusted external users."),
        ("P2", "Central security telemetry", "Centralize request-ID logs, retention, anomaly detection, and incident paging."),
    ]
    roadmap_data = [[p("PRIORITY", "TableHead"), p("CONTROL", "TableHead"), p("NEXT ACTION", "TableHead")]]
    for priority, control, action in residual:
        roadmap_data.append([p(priority, "TableCellBold"), p(control, "TableCellBold"), p(action, "TableCell")])
    roadmap = Table(roadmap_data, colWidths=[19 * mm, 49 * mm, 106 * mm], repeatRows=1)
    roadmap.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]), ("GRID", (0, 0), (-1, -1), 0.45, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("TEXTCOLOR", (0, 1), (0, 5), RED)]))
    story += [roadmap, Spacer(1, 7 * mm), p("Final conclusion", "H2X"), p("All confirmed code, database, credential, permission, host-access, and availability defects identified in this audit were remediated and verified in production. TrackerX satisfies the current single-host deployment model. The roadmap above defines the next maturity step for stronger availability and assurance."), Spacer(1, 5 * mm)]
    story += [
        Table(
            [[p("OWNER ACTION", "TableCellBold"), p("Temporary credentials are stored only at /home/blockexe/TrackerX/security-rotation-20260910.txt with mode 600. Retrieve through key-authenticated SSH, distribute privately, and delete after all seven users complete password changes.", "TableCell")]],
            colWidths=[34 * mm, 140 * mm],
            style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), CYAN), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#B9DCEB")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]),
        )
    ]
    return story


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = AuditDocTemplate(str(OUTPUT))
    document.build(build_story())
    print(OUTPUT)


if __name__ == "__main__":
    main()
