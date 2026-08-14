from __future__ import annotations

"""Attendance sheet: everyone can read their scope; only admin can edit."""

from datetime import date as date_type
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import AttendanceRecord, TeamMember, User
from app.models.attendance import ATTENDANCE_STATUSES
from app.schemas.attendance import AttendanceBulkInput, AttendanceInput, AttendanceOut

router = APIRouter(prefix="/attendance", tags=["attendance"])

_TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def _validate_date(value: str) -> str:
    try:
        return date_type.fromisoformat(value).isoformat()
    except ValueError:
        raise HTTPException(status_code=422, detail="Attendance date must use YYYY-MM-DD.")


def _validate_input(inp: AttendanceInput) -> None:
    _validate_date(inp.attendance_date)
    if inp.status != "not_recorded" and inp.status not in ATTENDANCE_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid attendance status '{inp.status}'.")
    for label, value in (("Check-in", inp.check_in), ("Check-out", inp.check_out)):
        if value and not _TIME_PATTERN.match(value):
            raise HTTPException(status_code=422, detail=f"{label} must use HH:MM.")
    if inp.check_in and inp.check_out and inp.check_in > inp.check_out:
        raise HTTPException(status_code=422, detail="Check-out must be after check-in.")


def _serialize(member: TeamMember, record: AttendanceRecord | None, day: str) -> dict:
    return {
        "id": record.id if record else None,
        "team_member_id": member.id,
        "employee_name": member.name,
        "employee_role": member.role,
        "attendance_date": day,
        "status": record.status if record else "not_recorded",
        "check_in": record.check_in if record else None,
        "check_out": record.check_out if record else None,
        "notes": record.notes if record else None,
        "recorded_by_name": (
            record.recorded_by.full_name if record and record.recorded_by else None
        ),
        "updated_at": record.updated_at if record else None,
    }


def _scoped_members(db: Session, user: User) -> list[TeamMember]:
    if user.role in ("admin", "pm"):
        return (
            db.query(TeamMember)
            .filter(TeamMember.is_active == 1)
            .order_by(TeamMember.name)
            .all()
        )
    member = db.query(TeamMember).filter(TeamMember.user_id == user.id).first()
    return [member] if member and bool(member.is_active) else []


@router.get("", response_model=list[AttendanceOut])
def attendance_sheet(
    attendance_date: str | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    day = _validate_date(attendance_date or date_type.today().isoformat())
    members = _scoped_members(db, user)
    member_ids = [member.id for member in members]
    rows = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.attendance_date == day,
            AttendanceRecord.team_member_id.in_(member_ids),
        )
        .all()
        if member_ids
        else []
    )
    by_member = {row.team_member_id: row for row in rows}
    return [_serialize(member, by_member.get(member.id), day) for member in members]


@router.put("/bulk", response_model=list[AttendanceOut])
def save_attendance_sheet(
    inp: AttendanceBulkInput,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    dates = {item.attendance_date for item in inp.records}
    if len(dates) > 1:
        raise HTTPException(status_code=422, detail="A bulk attendance sheet must use one date.")
    for item in inp.records:
        _validate_input(item)
        member = db.get(TeamMember, item.team_member_id)
        if member is None:
            raise HTTPException(status_code=422, detail="An employee in the sheet no longer exists.")
        record = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.team_member_id == item.team_member_id,
                AttendanceRecord.attendance_date == item.attendance_date,
            )
            .first()
        )
        if item.status == "not_recorded":
            if record:
                db.delete(record)
            continue
        if record is None:
            record = AttendanceRecord(
                team_member_id=item.team_member_id,
                attendance_date=item.attendance_date,
            )
            db.add(record)
        record.status = item.status
        record.check_in = item.check_in or None
        record.check_out = item.check_out or None
        record.notes = item.notes.strip() if item.notes and item.notes.strip() else None
        record.recorded_by_id = admin.id

    db.commit()
    if not inp.records:
        return []
    day = inp.records[0].attendance_date
    members = (
        db.query(TeamMember)
        .filter(TeamMember.is_active == 1)
        .order_by(TeamMember.name)
        .all()
    )
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.attendance_date == day)
        .all()
    )
    by_member = {record.team_member_id: record for record in records}
    return [_serialize(member, by_member.get(member.id), day) for member in members]
