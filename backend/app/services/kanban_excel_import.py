from __future__ import annotations

"""Validate, preview, and atomically apply Kanban Excel workbooks."""

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models import Milestone, Project, Task, TeamMember, User
from app.models.task import DELAY_CAUSES, TASK_STATUSES
from app.services.notifications import notify_members
from app.services.ooxml_workbook import WorkbookCell, read_xlsx, table_rows


MAX_TEXT = 20_000


def _issue(sheet: str, row: int, field: str, message: str) -> dict[str, Any]:
    return {"sheet": sheet, "row": row, "field": field, "message": message}


def _value(
    cells: dict[str, WorkbookCell],
    field: str,
    *,
    sheet: str,
    row: int,
    issues: list[dict[str, Any]],
) -> Any:
    cell = cells.get(field, WorkbookCell(None))
    if cell.formula:
        issues.append(_issue(sheet, row, field, "Formula cells are not accepted for imports."))
        return None
    value = cell.value
    if isinstance(value, str):
        value = value.strip()
        if len(value) > MAX_TEXT:
            issues.append(_issue(sheet, row, field, f"Value exceeds {MAX_TEXT:,} characters."))
            return None
        return value or None
    return value


def _integer(value: Any, sheet: str, row: int, field: str, issues: list[dict[str, Any]]) -> int | None:
    if value in {None, ""}:
        return None
    try:
        number = float(value)
        if not number.is_integer():
            raise ValueError
        return int(number)
    except (TypeError, ValueError):
        issues.append(_issue(sheet, row, field, "Enter a whole number."))
        return None


def _number(value: Any, sheet: str, row: int, field: str, issues: list[dict[str, Any]]) -> float | None:
    if value in {None, ""}:
        return None
    try:
        number = float(value)
        if number < 0 or number > 10_000:
            raise ValueError
        return number
    except (TypeError, ValueError):
        issues.append(_issue(sheet, row, field, "Enter a number from 0 to 10,000."))
        return None


def _iso_date(value: Any, sheet: str, row: int, field: str, issues: list[dict[str, Any]]) -> str | None:
    if value in {None, ""}:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return (date(1899, 12, 30) + timedelta(days=float(value))).isoformat()
        except (OverflowError, ValueError):
            issues.append(_issue(sheet, row, field, "Enter a valid Excel date or use YYYY-MM-DD."))
            return None
    text = str(value).strip()
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError:
        issues.append(_issue(sheet, row, field, "Use an Excel date or YYYY-MM-DD format."))
        return None


def _yes_no(value: Any, sheet: str, row: int, field: str, issues: list[dict[str, Any]]) -> bool:
    normalized = str(value or "no").strip().casefold()
    if normalized in {"yes", "true", "1", "y"}:
        return True
    if normalized in {"no", "false", "0", "n", ""}:
        return False
    issues.append(_issue(sheet, row, field, "Use Yes or No."))
    return False


def _normalized_status(value: Any) -> str:
    return str(value or "todo").strip().casefold().replace(" ", "_").replace("-", "_")


def _member_tokens(value: Any) -> list[str]:
    if value in {None, ""}:
        return []
    tokens = []
    for part in str(value).replace(";", ",").split(","):
        token = part.strip()
        if token:
            tokens.append(token.zfill(4) if token.isdigit() and len(token) < 4 else token)
    return list(dict.fromkeys(tokens))


def _empty_counts() -> dict[str, int]:
    return {
        "milestones_create": 0,
        "milestones_update": 0,
        "tasks_create": 0,
        "tasks_update": 0,
        "unchanged": 0,
    }


def import_kanban_excel(
    db: Session,
    *,
    project: Project,
    user: User,
    raw: bytes,
    commit: bool,
) -> dict[str, Any]:
    workbook = read_xlsx(raw)
    milestone_rows = table_rows(
        workbook,
        "Milestones",
        required_headers={"Milestone ID", "Title", "Start Date", "End Date", "Sort Order"},
    )
    task_rows = table_rows(
        workbook,
        "Tasks",
        required_headers={
            "Task ID",
            "Milestone ID",
            "Milestone Title",
            "Title",
            "Status",
            "Assignee Employee IDs",
        },
    )
    issues: list[dict[str, Any]] = []
    warnings: list[str] = []
    counts = _empty_counts()

    existing_milestones = {
        item.id: item
        for item in db.query(Milestone).filter(Milestone.project_id == project.id).all()
    }
    existing_by_title: dict[str, list[Milestone]] = defaultdict(list)
    for item in existing_milestones.values():
        existing_by_title[item.title.strip().casefold()].append(item)

    seen_ids: set[int] = set()
    milestone_plans: list[dict[str, Any]] = []
    planned_by_title: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row_number, cells in milestone_rows:
        sheet = "Milestones"
        raw_id = _value(cells, "Milestone ID", sheet=sheet, row=row_number, issues=issues)
        milestone_id = _integer(raw_id, sheet, row_number, "Milestone ID", issues)
        title = _value(cells, "Title", sheet=sheet, row=row_number, issues=issues)
        description = _value(cells, "Description", sheet=sheet, row=row_number, issues=issues)
        start_date = _iso_date(
            _value(cells, "Start Date", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "Start Date",
            issues,
        )
        end_date = _iso_date(
            _value(cells, "End Date", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "End Date",
            issues,
        )
        sort_order = _integer(
            _value(cells, "Sort Order", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "Sort Order",
            issues,
        )
        if not title:
            issues.append(_issue(sheet, row_number, "Title", "Milestone title is required."))
            continue
        if len(str(title)) > 300:
            issues.append(_issue(sheet, row_number, "Title", "Milestone title cannot exceed 300 characters."))
        if start_date and end_date and start_date > end_date:
            issues.append(_issue(sheet, row_number, "End Date", "End Date must be on or after Start Date."))
        existing = None
        if milestone_id is not None:
            if milestone_id in seen_ids:
                issues.append(_issue(sheet, row_number, "Milestone ID", "Milestone ID is duplicated in this workbook."))
            seen_ids.add(milestone_id)
            existing = existing_milestones.get(milestone_id)
            if existing is None:
                issues.append(_issue(sheet, row_number, "Milestone ID", "Milestone ID does not belong to this project."))
        else:
            matches = existing_by_title.get(str(title).strip().casefold(), [])
            if len(matches) == 1:
                existing = matches[0]
                warnings.append(f"Milestones row {row_number} matched existing milestone '{title}' by title.")
            elif len(matches) > 1:
                issues.append(_issue(sheet, row_number, "Title", "Title matches multiple milestones. Add the Milestone ID."))
        plan = {
            "row": row_number,
            "existing": existing,
            "title": str(title),
            "description": description,
            "start_date": start_date,
            "end_date": end_date,
            "sort_order": sort_order if sort_order is not None else len(milestone_plans),
        }
        milestone_plans.append(plan)
        planned_by_title[str(title).strip().casefold()].append(plan)
        counts["milestones_update" if existing else "milestones_create"] += 1

    all_members = db.query(TeamMember).filter(TeamMember.is_active == 1).all()
    members_by_number = {str(item.employee_number or item.id).strip().zfill(4): item for item in all_members}
    allowed_member_ids = {item.id for item in project.assigned_members}
    if project.project_manager_id:
        allowed_member_ids.add(project.project_manager_id)

    existing_tasks = {
        task.id: task
        for task in db.query(Task)
        .join(Milestone, Task.milestone_id == Milestone.id)
        .filter(Milestone.project_id == project.id)
        .all()
    }
    seen_task_ids: set[int] = set()
    task_plans: list[dict[str, Any]] = []
    for row_number, cells in task_rows:
        sheet = "Tasks"
        task_id = _integer(
            _value(cells, "Task ID", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "Task ID",
            issues,
        )
        milestone_id = _integer(
            _value(cells, "Milestone ID", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "Milestone ID",
            issues,
        )
        milestone_title = _value(cells, "Milestone Title", sheet=sheet, row=row_number, issues=issues)
        title = _value(cells, "Title", sheet=sheet, row=row_number, issues=issues)
        description = _value(cells, "Description", sheet=sheet, row=row_number, issues=issues)
        status = _normalized_status(_value(cells, "Status", sheet=sheet, row=row_number, issues=issues))
        start_date = _iso_date(
            _value(cells, "Start Date", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "Start Date",
            issues,
        )
        end_date = _iso_date(
            _value(cells, "End Date", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "End Date",
            issues,
        )
        est_days = _number(
            _value(cells, "Estimated Days", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "Estimated Days",
            issues,
        )
        is_delayed = _yes_no(
            _value(cells, "Is Delayed", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "Is Delayed",
            issues,
        )
        delay_cause = _value(cells, "Delay Cause", sheet=sheet, row=row_number, issues=issues)
        delay_comment = _value(cells, "Delay Comment", sheet=sheet, row=row_number, issues=issues)
        sort_order = _integer(
            _value(cells, "Sort Order", sheet=sheet, row=row_number, issues=issues),
            sheet,
            row_number,
            "Sort Order",
            issues,
        )
        tokens = _member_tokens(
            _value(cells, "Assignee Employee IDs", sheet=sheet, row=row_number, issues=issues)
        )
        members: list[TeamMember] = []
        for token in tokens:
            member = members_by_number.get(token)
            if member is None:
                issues.append(_issue(sheet, row_number, "Assignee Employee IDs", f"Employee ID {token} was not found or is inactive."))
                continue
            if user.role == "pm" and member.id not in allowed_member_ids:
                issues.append(_issue(sheet, row_number, "Assignee Employee IDs", f"Employee {token} is not assigned to this project team."))
                continue
            members.append(member)
        if not title:
            issues.append(_issue(sheet, row_number, "Title", "Task title is required."))
            continue
        if len(str(title)) > 300:
            issues.append(_issue(sheet, row_number, "Title", "Task title cannot exceed 300 characters."))
        if status not in TASK_STATUSES:
            issues.append(_issue(sheet, row_number, "Status", f"Use one of: {', '.join(TASK_STATUSES)}."))
        if start_date and end_date and start_date > end_date:
            issues.append(_issue(sheet, row_number, "End Date", "End Date must be on or after Start Date."))
        if is_delayed and delay_cause not in DELAY_CAUSES:
            issues.append(_issue(sheet, row_number, "Delay Cause", "Delayed tasks require Company or Client."))
        if not is_delayed:
            delay_cause = None
            delay_comment = None

        milestone_plan = None
        if milestone_id is not None:
            for candidate in milestone_plans:
                if candidate["existing"] and candidate["existing"].id == milestone_id:
                    milestone_plan = candidate
                    break
            if milestone_plan is None:
                existing_ms = existing_milestones.get(milestone_id)
                if existing_ms:
                    milestone_plan = {
                        "existing": existing_ms,
                        "record": existing_ms,
                        "title": existing_ms.title,
                    }
        if milestone_plan is None and milestone_title:
            candidates = planned_by_title.get(str(milestone_title).strip().casefold(), [])
            if len(candidates) == 1:
                milestone_plan = candidates[0]
            elif len(candidates) > 1:
                issues.append(_issue(sheet, row_number, "Milestone Title", "Milestone title is ambiguous. Add its ID."))
        if milestone_plan is None:
            issues.append(_issue(sheet, row_number, "Milestone ID", "Identify a milestone in this workbook by ID or exact title."))

        existing = None
        if task_id is not None:
            if task_id in seen_task_ids:
                issues.append(_issue(sheet, row_number, "Task ID", "Task ID is duplicated in this workbook."))
            seen_task_ids.add(task_id)
            existing = existing_tasks.get(task_id)
            if existing is None:
                issues.append(_issue(sheet, row_number, "Task ID", "Task ID does not belong to this project."))
        task_plans.append(
            {
                "row": row_number,
                "existing": existing,
                "milestone": milestone_plan,
                "title": str(title),
                "description": description,
                "status": status,
                "members": members,
                "start_date": start_date,
                "end_date": end_date,
                "est_days": est_days,
                "is_delayed": is_delayed,
                "delay_cause": delay_cause,
                "delay_comment": delay_comment,
                "sort_order": sort_order if sort_order is not None else len(task_plans),
            }
        )
        counts["tasks_update" if existing else "tasks_create"] += 1

    result: dict[str, Any] = {
        "workspace": "kanban",
        "valid": not issues,
        "committed": False,
        "rows_read": len(milestone_rows) + len(task_rows),
        "counts": counts,
        "warnings": warnings,
        "errors": issues[:200],
    }
    if issues or not commit:
        return result

    assignment_notifications: dict[int, tuple[TeamMember, int]] = {}
    for plan in milestone_plans:
        milestone = plan["existing"] or Milestone(project_id=project.id, workstream="project")
        milestone.title = plan["title"]
        milestone.description = plan["description"]
        milestone.start_date = plan["start_date"]
        milestone.end_date = plan["end_date"]
        milestone.sort_order = plan["sort_order"]
        if plan["existing"] is None:
            db.add(milestone)
        db.flush()
        plan["record"] = milestone

    for plan in task_plans:
        task = plan["existing"] or Task()
        previous_ids = {member.id for member in task.assigned_members} if plan["existing"] else set()
        task.milestone_id = plan["milestone"]["record"].id
        task.title = plan["title"]
        task.description = plan["description"]
        task.status = plan["status"]
        task.start_date = plan["start_date"]
        task.end_date = plan["end_date"]
        task.est_days = plan["est_days"]
        task.is_delayed = 1 if plan["is_delayed"] else 0
        task.delay_cause = plan["delay_cause"]
        task.delay_comment = plan["delay_comment"]
        task.sort_order = plan["sort_order"]
        task.assigned_members = plan["members"]
        task.assigned_member_id = plan["members"][0].id if plan["members"] else None
        if plan["existing"] is None:
            db.add(task)
        for member in plan["members"]:
            if member.id not in previous_ids:
                current = assignment_notifications.get(member.id, (member, 0))
                assignment_notifications[member.id] = (member, current[1] + 1)

    for member, task_count in assignment_notifications.values():
        notify_members(
            db,
            [member],
            kind="task_assignment",
            title=f"Kanban updated in {project.name}",
            message=f"{user.full_name} assigned or updated {task_count} task{'s' if task_count != 1 else ''} for you by Excel import.",
            link=f"/projects/{project.id}?tab=kanban",
            exclude_user_id=user.id,
        )
    db.commit()
    result["committed"] = True
    return result
