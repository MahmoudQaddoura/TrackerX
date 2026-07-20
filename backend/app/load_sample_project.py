from __future__ import annotations

"""
load_sample_project.py
Replace whatever project/milestone/task/team-member data is currently in the
database with the real projects outlined in data/sample_project.csv (PSUT)
and data/JAF_Tasks.csv (JAF). Users are left untouched so demo logins still
work. Only fields present in the CSVs are populated — everything else
(dates, status, delays) is left at its default for the PM to fill in later
through the platform. Run with:  python -m app.load_sample_project
"""

import csv
import io
import re
from pathlib import Path

from app.db import Base, SessionLocal, engine
from app.models import Meeting, Milestone, Project, Task, TeamMember
from app.services.csv_parser import parse_project_csv

CSV_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "sample_project.csv"
JAF_CSV_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "JAF_Tasks.csv"

_TASK_NUM_RE = re.compile(r"^(\d+)\.\d+$")
_DR_PREFIX = re.compile(r"^Dr\.\s*", re.IGNORECASE)


def _normalize_name(raw: str) -> str:
    """Collapse 'Dr.', spaces, and case so cross-CSV names match."""
    return _DR_PREFIX.sub("", raw.strip()).replace(" ", "").lower()


def _parse_jaf_csv(text: str) -> dict:
    """
    Parse JAF_Tasks.csv which has no milestone headers.
    Groups tasks by major number prefix: 1.1,1.2→"Milestone 1", 2.1,2.2→"Milestone 2", etc.
    """
    rows = list(csv.reader(io.StringIO(text)))
    if rows and rows[0] and rows[0][0].strip() == "#":
        rows = rows[1:]

    milestones: dict[int, list[dict]] = {}
    name = "JAF Project"

    for cells in rows:
        if not any(c.strip() for c in cells):
            continue
        num = (cells[0] if len(cells) > 0 else "").strip()
        task_title = (cells[1] if len(cells) > 1 else "").strip()
        description = (cells[2] if len(cells) > 2 else "").strip()
        est_raw = (cells[3] if len(cells) > 3 else "").strip()
        assignee = (cells[4] if len(cells) > 4 else "").strip()

        m = _TASK_NUM_RE.match(num)
        if not m:
            continue

        ms_num = int(m.group(1))
        try:
            est_days = float(est_raw) if est_raw else None
        except ValueError:
            est_days = None

        milestones.setdefault(ms_num, []).append(
            {
                "num": num,
                "title": task_title or num,
                "description": description or None,
                "est_days": est_days,
                "assignee": assignee or None,
            }
        )

    return {
        "name": name,
        "milestones": [
            {"title": f"Milestone {n}", "tasks": tasks}
            for n, tasks in sorted(milestones.items())
        ],
    }


def _find_or_create_member(db, cache: dict, name: str) -> TeamMember:
    """Look up or create a TeamMember, normalizing name so 'Al Balawi' and 'AlBalawi' match."""
    key = _normalize_name(name)
    if key in cache:
        return cache[key]
    # Also check the DB for an existing member with a different spelling.
    existing = db.query(TeamMember).all()
    for m in existing:
        if _normalize_name(m.name) == key:
            cache[key] = m
            return m
    member = TeamMember(name=name.strip(), role=None, is_active=1)
    db.add(member)
    db.flush()
    cache[key] = member
    return member


def _load_project(db, outline: dict, member_cache: dict) -> Project:
    project = Project(name=outline["name"], status="active")
    db.add(project)
    db.flush()

    task_count = 0
    for ms_order, ms in enumerate(outline["milestones"]):
        milestone = Milestone(project_id=project.id, title=ms["title"], sort_order=ms_order)
        db.add(milestone)
        db.flush()
        for t_order, t in enumerate(ms["tasks"]):
            member_id = None
            if t.get("assignee"):
                member = _find_or_create_member(db, member_cache, t["assignee"])
                member_id = member.id
            db.add(
                Task(
                    milestone_id=milestone.id,
                    title=t["title"],
                    description=t.get("description"),
                    est_days=t.get("est_days"),
                    status="todo",
                    assigned_member_id=member_id,
                    sort_order=t_order,
                )
            )
            task_count += 1

    print(
        f"  Loaded '{outline['name']}': {len(outline['milestones'])} milestones, "
        f"{task_count} tasks."
    )
    return project


def load() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Wipe existing project data (cascades to milestones/tasks/meetings/documents)
        # and the team directory, so only the real CSV data remains. Users are untouched.
        db.query(Meeting).delete()
        db.query(Task).delete()
        db.query(Milestone).delete()
        db.query(Project).delete()
        db.query(TeamMember).delete()
        db.flush()

        member_cache: dict[str, TeamMember] = {}

        # Load PSUT project from the standard CSV
        psut_text = CSV_PATH.read_text(encoding="utf-8-sig")
        psut_outline = parse_project_csv(psut_text)
        _load_project(db, psut_outline, member_cache)

        # Load JAF project — auto-grouped by task-number prefix
        if JAF_CSV_PATH.exists():
            jaf_text = JAF_CSV_PATH.read_text(encoding="utf-8-sig")
            jaf_outline = _parse_jaf_csv(jaf_text)
            _load_project(db, jaf_outline, member_cache)

        db.commit()
        print(f"Done. {len(member_cache)} team members across all projects.")
    finally:
        db.close()


if __name__ == "__main__":
    load()
