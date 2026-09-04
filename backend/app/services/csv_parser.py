"""
services/csv_parser.py
Parse the project-plan CSV (the format produced by scripts/xlsx_to_csv.py) into
a structured project outline. Ported from the original web/js/csv_parser.js and
csv_loader.js row-classification rules — one purpose: text -> outline.

CSV columns: #, Task, Description, Est. Acc Days, Assignee, Internal Delays, Client Delays

Row types (detected from the first column):
  - title      : a name with an empty Task column  -> the project name
  - milestone  : first column starts with "Milestone"
  - task       : first column matches N.N (e.g. 1.1, 2.14)
  - summary    : first column contains "Estimated Effort" (ignored)
"""

from __future__ import annotations

import csv
import io
import re

_MILESTONE_RE = re.compile(r"^Milestone\s", re.IGNORECASE)
_TASK_RE = re.compile(r"^\d+\.\d+")
_SUMMARY_RE = re.compile(r"Estimated Effort", re.IGNORECASE)
MAX_CSV_ROWS = 10_000
MAX_CELL_LENGTH = 20_000


def _classify(cells: list[str]) -> str:
    first = (cells[0] if cells else "").strip()
    second = (cells[1] if len(cells) > 1 else "").strip()
    if _MILESTONE_RE.search(first):
        return "milestone"
    if _SUMMARY_RE.search(first):
        return "summary"
    if _TASK_RE.match(first):
        return "task"
    if first and not second:
        return "title"
    return "other"


def parse_project_csv(text: str) -> dict:
    """
    Return a project outline:
      {
        "name": str,
        "milestones": [
          {"title": str, "tasks": [
             {"num", "title", "description", "est_days", "assignee"}
          ]}
        ]
      }
    Raises ValueError if no tasks/milestones can be found.
    """
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) > MAX_CSV_ROWS:
        raise ValueError(f"CSV contains more than {MAX_CSV_ROWS:,} rows.")
    if any(len(cell) > MAX_CELL_LENGTH for row in rows for cell in row):
        raise ValueError("CSV contains a cell larger than the 20,000-character limit.")
    # Drop a header row if present.
    if rows and rows[0] and rows[0][0].strip() == "#":
        rows = rows[1:]

    name = "Imported Project"
    milestones: list[dict] = []
    current: dict | None = None

    for cells in rows:
        if not any(c.strip() for c in cells):  # skip blank lines
            continue
        kind = _classify(cells)
        num = (cells[0] if len(cells) > 0 else "").strip()
        task_title = (cells[1] if len(cells) > 1 else "").strip()
        description = (cells[2] if len(cells) > 2 else "").strip()
        est_raw = (cells[3] if len(cells) > 3 else "").strip()
        assignee = (cells[4] if len(cells) > 4 else "").strip()

        if kind == "title":
            name = num
        elif kind == "milestone":
            current = {"title": num, "tasks": []}
            milestones.append(current)
        elif kind == "task" and current is not None:
            try:
                est_days = float(est_raw) if est_raw else None
            except ValueError:
                est_days = None
            current["tasks"].append(
                {
                    "num": num,
                    "title": task_title or num,
                    "description": description or None,
                    "est_days": est_days,
                    "assignee": assignee or None,
                }
            )

    if not milestones:
        raise ValueError(
            "No milestones/tasks found. Expected the 7-column project-plan CSV format."
        )
    return {"name": name, "milestones": milestones}
