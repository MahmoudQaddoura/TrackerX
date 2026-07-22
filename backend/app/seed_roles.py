from __future__ import annotations

"""
seed_roles.py
Create the demo user accounts and link them to the CSV-imported team_members.
No teams — just user accounts linked to existing assignee records.

  - admin     : Dr. Mohammad Alnabhan (Owner — not listed as a regular employee)
  - pm        : Yazan Abu Osbeh
  - client    : "PSUT Stakeholder" (placeholder)
  - developer : the remaining active assignees

Mohammad Abzakh left the company: soft-deactivated (is_active -> 0), no login.

This script also populates professional role titles on each team_member so the
employee directory shows the correct designation.

Idempotent: does nothing if the admin user already exists. Run after
`python -m app.load_sample_project`:  python -m app.seed_roles
"""

from app.db import Base, SessionLocal, engine
from app.models import Project, TeamMember, User
from app.models.team import project_clients
from app.security import hash_password

DEMO_PASSWORD = "ChangeMe123!"

# Professional role titles for each team member.
PROFESSIONAL_ROLES = {
    "Yazan Abu Osbeh": "Project Manager & Technical Lead",
    "Mahmoud Qaddoura": "Development Lead",
    "Mohammad Al Balawi": "Security Lead",
    "Lina Khalil": "Systems and Devops Engineer",
    "Abed Al Qader Madi": "AI Engineer",
    "Yehya Mujahid": "Full-stack Developer",
    # Dr. Alnabhan is the Owner — he is NOT a regular employee and gets a special tag.
    "Mohammad Alnabhan": "Owner",
}

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
            full_name="Dr. Mohammad Alnabhan",
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

        # Link PM to their team_member record and set professional role.
        pm_member = _member_or_raise(db, PM_NAME)
        pm_member.user_id = pm_user.id
        if PM_NAME in PROFESSIONAL_ROLES:
            pm_member.role = PROFESSIONAL_ROLES[PM_NAME]

        # Create developer logins, link to team_member records, and set professional roles.
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
            if name in PROFESSIONAL_ROLES:
                member.role = PROFESSIONAL_ROLES[name]
            dev_emails.append(dev_user.email)

        # Soft-deactivate the departed member.
        departed = db.query(TeamMember).filter(TeamMember.name == DEPARTED).first()
        if departed is not None:
            departed.is_active = 0
            departed.user_id = None

        # Dr. Mohammad Alnabhan — Owner special handling.
        # He may have task assignments from the CSV, so ensure his team_member exists
        # and is tagged as Owner. He is NOT a regular employee but his card still
        # appears so his tasks can be seen and delegated if needed.
        owner_names = ["Mohammad Alnabhan", "Dr. Mohammad Alnabhan"]
        for owner_name in owner_names:
            owner_member = db.query(TeamMember).filter(TeamMember.name == owner_name).first()
            if owner_member is not None:
                owner_member.role = "Owner"
                owner_member.user_id = admin.id
                break

        # Apply any remaining professional roles to team_members that were missed.
        all_members = db.query(TeamMember).all()
        for m in all_members:
            if m.name in PROFESSIONAL_ROLES and m.role is None:
                m.role = PROFESSIONAL_ROLES[m.name]

        db.commit()
        logins = ["admin@demo.com", pm_user.email, "client@demo.com", *dev_emails]
        print(f"Role seed complete. {len(logins)} user accounts created.")
        print(f"Logins (password {DEMO_PASSWORD}): " + ", ".join(logins))
    finally:
        db.close()


if __name__ == "__main__":
    seed()