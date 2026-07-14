"""
seed_roles.py
Create the real org accounts and team structure for the PSUT project, layered
on top of the CSV-imported project/milestones/tasks/team_members:

  - admin     : Mohammad Alnabhan  (replaces the old owner@demo.com persona)
  - pm        : Yazan Abu Osbeh    (leads the new team)
  - client    : "PSUT Stakeholder" (placeholder — no real contact name was
                given in the source CSV)
  - developer : the remaining active assignees

Mohammad Abzakh left the company: soft-deactivated (is_active -> 0), not
added to the team, no login — but his historical task assignments are left
untouched so that attribution survives.

Idempotent: does nothing if a Team already exists. Run after
`python -m app.load_sample_project`:  python -m app.seed_roles
"""

from app.db import Base, SessionLocal, engine
from app.models import Project, Team, TeamMember, User
from app.security import hash_password

DEMO_PASSWORD = "ChangeMe123!"

LEAD_NAME = "Yazan Abu Osbeh"
DEVELOPERS = [
    "Mahmoud Qaddoura",
    "Mohammad Al Balawi",
    "Lina Khalil",
    "Abed Al Qader Madi",
    "Yehya Mujahid",
]
DEPARTED = "Mohammad Abzakh"


def _email_for(name: str) -> str:
    return name.lower().replace(" ", ".") + "@demo.com"


def _member_or_raise(db, name: str) -> TeamMember:
    member = db.query(TeamMember).filter(TeamMember.name == name).first()
    if member is None:
        raise RuntimeError(
            f"Expected a team member named '{name}' from the CSV import — "
            "run `python -m app.load_sample_project` first."
        )
    return member


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Team).first() is not None:
            print("Role/team seed skipped — a team already exists.")
            return

        project = db.query(Project).first()
        if project is None:
            raise RuntimeError("No project found — run `python -m app.load_sample_project` first.")

        admin = User(
            email="admin@demo.com",
            hashed_password=hash_password(DEMO_PASSWORD),
            full_name="Mohammad Alnabhan",
            role="admin",
        )
        client = User(
            email="client@demo.com",
            hashed_password=hash_password(DEMO_PASSWORD),
            full_name="PSUT Stakeholder",
            role="client",
        )
        lead_user = User(
            email=_email_for(LEAD_NAME),
            hashed_password=hash_password(DEMO_PASSWORD),
            full_name=LEAD_NAME,
            role="pm",
        )
        db.add_all([admin, client, lead_user])
        db.flush()

        lead_member = _member_or_raise(db, LEAD_NAME)

        team = Team(
            name="PSUT LLM Engine Delivery Team",
            function="Software Engineering",
            lead_user_id=lead_user.id,
        )
        db.add(team)
        db.flush()

        team.projects.append(project)
        project.clients.append(client)
        lead_member.user_id = lead_user.id
        lead_member.team_id = team.id

        dev_emails = []
        for name in DEVELOPERS:
            member = _member_or_raise(db, name)
            dev_user = User(
                email=_email_for(name),
                hashed_password=hash_password(DEMO_PASSWORD),
                full_name=name,
                role="developer",
            )
            db.add(dev_user)
            db.flush()
            member.user_id = dev_user.id
            member.team_id = team.id
            dev_emails.append(dev_user.email)

        departed = db.query(TeamMember).filter(TeamMember.name == DEPARTED).first()
        if departed is not None:
            departed.is_active = 0
            departed.team_id = None
            departed.user_id = None

        db.commit()
        print(f"Role/team seed complete. Team '{team.name}' led by {LEAD_NAME}.")
        logins = ["admin@demo.com", lead_user.email, "client@demo.com", *dev_emails]
        print(f"Logins (password {DEMO_PASSWORD}): " + ", ".join(logins))
    finally:
        db.close()


if __name__ == "__main__":
    seed()
