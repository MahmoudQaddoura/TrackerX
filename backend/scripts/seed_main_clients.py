from __future__ import annotations

"""Create the initial TrackerX client organizations with disabled portal access."""

import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func

from app.db import Base, SessionLocal, engine
from app.models import ClientProfile, Project, User, project_clients
from app.security import hash_password


CLIENTS = (
    {
        "organization": "Alawneh Exchange",
        "full_name": "Alawneh Exchange Client",
        "email": "alawneh.client@portal.trackerx.app",
        "project_matches": ("Alawneh",),
    },
    {
        "organization": "Jordanian Armed Forces (JAF)",
        "full_name": "JAF Client",
        "email": "jaf.client@portal.trackerx.app",
        "project_matches": ("JAF",),
    },
    {
        "organization": "Princess Sumaya University for Technology (PSUT)",
        "full_name": "PSUT Client",
        "email": "psut.client@portal.trackerx.app",
        "project_matches": ("PSUT LLM", "VerifyX"),
    },
    {
        "organization": "Ministry of Digital Economy and Entrepreneurship (MODEE)",
        "full_name": "MODEE Client",
        "email": "modee.client@portal.trackerx.app",
        "project_matches": ("MODEE",),
    },
)


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for definition in CLIENTS:
            client = (
                db.query(User)
                .join(ClientProfile, ClientProfile.user_id == User.id)
                .filter(
                    User.role == "client",
                    func.lower(ClientProfile.organization)
                    == definition["organization"].lower(),
                )
                .first()
            )
            if client is None and definition["organization"] == "Alawneh Exchange":
                client = (
                    db.query(User)
                    .filter(User.role == "client", func.lower(User.email) == "client@demo.com")
                    .first()
                )
            if client is None:
                client = User(
                    email=definition["email"],
                    full_name=definition["full_name"],
                    role="client",
                    access_level="read",
                    is_enabled=0,
                    must_change_password=1,
                    hashed_password=hash_password(secrets.token_urlsafe(32)),
                )
                db.add(client)
                db.flush()
            else:
                if client.email == "client@demo.com":
                    client.full_name = definition["full_name"]
                    client.email = definition["email"]
                    client.is_enabled = 0
                    client.must_change_password = 1
                    client.hashed_password = hash_password(secrets.token_urlsafe(32))
                elif client.email.endswith("@trackerx.local"):
                    client.email = definition["email"]

            if client.client_profile is None:
                client.client_profile = ClientProfile(
                    organization=definition["organization"],
                    notes="Initial client organization. Add the official contact details before enabling portal access.",
                )
            else:
                client.client_profile.organization = definition["organization"]

            for project_match in definition["project_matches"]:
                project = (
                    db.query(Project)
                    .filter(
                        Project.project_type == "actual_project",
                        Project.name.ilike(f"%{project_match}%"),
                    )
                    .order_by(Project.id)
                    .first()
                )
                if project is None:
                    continue
                existing = db.execute(
                    project_clients.select().where(
                        project_clients.c.project_id == project.id,
                        project_clients.c.user_id == client.id,
                    )
                ).first()
                if existing is None:
                    db.execute(
                        project_clients.insert().values(
                            project_id=project.id,
                            user_id=client.id,
                        )
                    )
        db.commit()


if __name__ == "__main__":
    seed()
