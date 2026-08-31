from __future__ import annotations

"""Allocation of stable, human-readable employee numbers."""

from sqlalchemy.orm import Session

from app.models import TeamMember


def assign_employee_number(db: Session, member: TeamMember) -> str:
    """Assign the next number after the highest number already in use."""
    if member.employee_number:
        return member.employee_number

    db.flush()
    used_numbers = {
        int(value)
        for (value,) in db.query(TeamMember.employee_number)
        .filter(TeamMember.employee_number.is_not(None))
        .all()
        if value and value.isdigit()
    }
    next_number = max(used_numbers, default=0) + 1
    member.employee_number = f"{next_number:04d}"
    return member.employee_number
