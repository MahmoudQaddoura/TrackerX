"""
seed_roles.py
Create the demo user accounts and link them to the CSV-imported team_members.
No teams — just user accounts linked to existing assignee records.

  - admin     : Mohammad Alnabhan
  - pm        : Yazan Abu Osbeh
  - client    : "PSUT Stakeholder" (placeholder)
  - developer : the remaining active assignees

Mohammad Abzakh left the company: soft-deactivated (is_active -> 0), no login.

Idempotent: does nothing if the admin user already exists. Run after
`python -m app.load_sample_project`:  python -m app.seed_roles
"""

from app.db import Base, SessionLocal, engine
from app.models import Project, TeamMember, User
from app.models.team import project_clients
from app.security import hash_password

DEMO_PASSWORD = "ChangeMe123!"

PM_NAME = "Yazan Abu Osbeh"
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
        if db.query(User).filter(User.email == "admin@demo.com").first() is not None:
            print("Role seed skipped — demo users already exist.")
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
        pm_user = User(
            email=_email_for(PM_NAME),
            hashed_password=hash_password(DEMO_PASSWORD),
            full_name=PM_NAME,
            role="pm",
        )
        db.add_all([admin, client, pm_user])
        db.flush()

        # Link client to the PSUT project.
        db.execute(project_clients.insert().values(project_id=project.id, user_id=client.id))

        # Link PM to their team_member record.
        pm_member = _member_or_raise(db, PM_NAME)
        pm_member.user_id = pm_user.id

        # Create developer logins and link to team_member records.
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
            dev_emails.append(dev_user.email)

        # Soft-deactivate the departed member.
        departed = db.query(TeamMember).filter(TeamMember.name == DEPARTED).first()
        if departed is not None:
            departed.is_active = 0
            departed.user_id = None

        db.commit()
        logins = ["admin@demo.com", pm_user.email, "client@demo.com", *dev_emails]
        print(f"Role seed complete. {len(logins)} user accounts created.")
        print(f"Logins (password {DEMO_PASSWORD}): " + ", ".join(logins))
    finally:
        db.close()


if __name__ == "__main__":
    seed()
