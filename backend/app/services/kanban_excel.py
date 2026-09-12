from __future__ import annotations

"""Build TrackerX Kanban Excel exports and reusable import templates."""

from datetime import datetime

from app.services.ooxml_workbook import (
    package_xlsx,
    row_xml,
    sheet_xml,
    table_sheet_xml,
    text_cell,
)


MILESTONE_HEADERS = [
    "Milestone ID",
    "Title",
    "Description",
    "Start Date",
    "End Date",
    "Sort Order",
    "Total Tasks",
    "Done Tasks",
    "Progress %",
    "Risk",
    "Created At",
    "Updated At",
]

TASK_HEADERS = [
    "Task ID",
    "Milestone ID",
    "Milestone Title",
    "Title",
    "Description",
    "Status",
    "Assignee Employee IDs",
    "Assignee Names",
    "Start Date",
    "End Date",
    "Estimated Days",
    "Is Delayed",
    "Delay Cause",
    "Delay Comment",
    "Sort Order",
    "Risk",
    "Created At",
    "Updated At",
]


def _instructions(project_name: str, project_id: int, template: bool) -> str:
    mode = "Blank import template" if template else "Editable project export"
    lines = [
        ("Purpose", f"{mode} for {project_name}."),
        ("Safe workflow", "Edit the Milestones and Tasks sheets, then preview the workbook in TrackerX before importing."),
        ("Create records", "Leave the ID blank. Tasks must identify a milestone by Milestone ID or exact Milestone Title."),
        ("Update records", "Keep the exported ID. TrackerX only updates records that belong to this project."),
        ("Assignees", "Use comma-separated employee IDs such as 0002, 0004. Names are exported for reference."),
        ("Dates", "Use YYYY-MM-DD. Start Date must be on or before End Date."),
        ("Task status", "Use todo, in_progress, in_review, blocked, or done."),
        ("Delayed tasks", "Use Yes or No. A delayed task requires Company or Client in Delay Cause."),
        ("Import behavior", "Import creates new rows and updates matched IDs. It never deletes missing milestones or tasks."),
        ("Validation", "Formula cells, duplicate IDs, invalid values, and cross-project references are rejected."),
    ]
    rows = [
        row_xml(1, [text_cell(1, 1, "KANBAN EXCEL WORKFLOW", 1)], 34),
        row_xml(2, [text_cell(2, 1, f"{project_name} · Project ID {project_id}", 2)], 22),
        row_xml(4, [text_cell(4, 1, "Field", 5), text_cell(4, 2, "Guidance", 5)], 28),
    ]
    for index, (label, guidance) in enumerate(lines, start=5):
        rows.append(row_xml(index, [text_cell(index, 1, label, 6), text_cell(index, 2, guidance, 6)], 34))
    last_row = 4 + len(lines)
    return sheet_xml(
        rows,
        2,
        last_row,
        [24, 100],
        merges=["A1:B1", "A2:B2"],
        freeze_rows=4,
        autofilter=f"A4:B{last_row}",
        landscape=False,
    )


def _timestamp(value: object | None) -> object | None:
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(value, datetime):
        return value.astimezone().strftime("%Y-%m-%d %H:%M:%S") if value.tzinfo else value.strftime("%Y-%m-%d %H:%M:%S")
    return value


def build_kanban_excel(
    *,
    project_id: int,
    project_name: str,
    milestones: list[dict],
    tasks: list[dict],
    exported_by: str,
    template: bool = False,
) -> bytes:
    milestone_by_id = {item["id"]: item for item in milestones}
    milestone_rows = [
        [
            item.get("id"),
            item.get("title"),
            item.get("description"),
            item.get("start_date"),
            item.get("end_date"),
            item.get("sort_order"),
            item.get("total_tasks"),
            item.get("done_tasks"),
            item.get("progress_pct"),
            item.get("risk_level"),
            _timestamp(item.get("created_at")),
            _timestamp(item.get("updated_at")),
        ]
        for item in milestones
    ]
    task_rows = []
    for item in tasks:
        members = item.get("assigned_members") or []
        task_rows.append(
            [
                item.get("id"),
                item.get("milestone_id"),
                milestone_by_id.get(item.get("milestone_id"), {}).get("title"),
                item.get("title"),
                item.get("description"),
                item.get("status"),
                ", ".join(
                    str(member.get("employee_number") or member.get("id") or "")
                    for member in members
                    if member.get("employee_number") or member.get("id")
                ),
                ", ".join(str(member.get("name") or "") for member in members if member.get("name")),
                item.get("start_date"),
                item.get("end_date"),
                item.get("est_days"),
                "Yes" if item.get("is_delayed") else "No",
                item.get("delay_cause"),
                item.get("delay_comment"),
                item.get("sort_order"),
                item.get("risk_level"),
                _timestamp(item.get("created_at")),
                _timestamp(item.get("updated_at")),
            ]
        )

    if template:
        milestone_rows = []
        task_rows = []
    milestone_sheet = table_sheet_xml(
        "MILESTONES",
        f"{project_name} · leave Milestone ID blank to create a record",
        MILESTONE_HEADERS,
        milestone_rows,
        [13, 34, 48, 15, 15, 12, 12, 12, 12, 14, 22, 22],
        status_columns={10},
    )
    task_sheet = table_sheet_xml(
        "TASKS",
        f"{project_name} · use employee IDs for reliable assignment matching",
        TASK_HEADERS,
        task_rows,
        [10, 14, 32, 36, 52, 15, 26, 32, 15, 15, 15, 13, 15, 36, 12, 14, 22, 22],
        status_columns={6, 16},
    )
    return package_xlsx(
        [
            ("Instructions", _instructions(project_name, project_id, template)),
            ("Milestones", milestone_sheet),
            ("Tasks", task_sheet),
        ],
        title=f"TrackerX Kanban - {project_name}",
        creator=exported_by,
    )
