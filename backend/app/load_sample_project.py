from __future__ import annotations

"""
load_sample_project.py
Replace whatever project/milestone/task/team-member data is currently in the
database with the real project outlined in data/sample_project.csv. Users
(pm@demo.com / owner@demo.com) are left untouched so the demo login still
works. Only fields present in the CSV are populated — everything else
(dates, status, delays) is left at its default for the PM to fill in later
through the platform. Run with:  python -m app.load_sample_project
"""

from pathlib import Path

from app.db import Base, SessionLocal, engine
from app.models import Meeting, Milestone, Project, Task, TeamMember
from app.services.csv_parser import parse_project_csv

CSV_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "sample_project.csv"


def _find_or_create_member(db, cache: dict, name: str) -> TeamMember:
    key = name.strip().lower()
    if key in cache:
        return cache[key]
    member = TeamMember(name=name.strip(), role=None, is_active=1)
    db.add(member)
    db.flush()
    cache[key] = member
    return member


def load() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        text = CSV_PATH.read_text(encoding="utf-8-sig")
        outline = parse_project_csv(text)

        # Wipe existing project data (cascades to milestones/tasks/meetings/documents)
        # and the team directory, so only the real CSV data remains. Users are untouched.
        db.query(Meeting).delete()
        db.query(Task).delete()
        db.query(Milestone).delete()
        db.query(Project).delete()
        db.query(TeamMember).delete()
        db.flush()

        project = Project(name=outline["name"], status="active")
        db.add(project)
        db.flush()

        member_cache: dict[str, TeamMember] = {}
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

        db.commit()
        print(
            f"Loaded '{outline['name']}': {len(outline['milestones'])} milestones, "
            f"{sum(len(m['tasks']) for m in outline['milestones'])} tasks, "
            f"{len(member_cache)} team members."
        )
    finally:
        db.close()


if __name__ == "__main__":
    load()
