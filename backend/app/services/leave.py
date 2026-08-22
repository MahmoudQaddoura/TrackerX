from __future__ import annotations

"""Shared leave approval and attendance-autofill operations."""

from datetime import date as date_type, timedelta

from sqlalchemy.orm import Session

from app.models import AttendanceRecord, LeaveRequest, User


def duration_hours(start_time: str, end_time: str) -> float:
    start_hour, start_minute = (int(part) for part in start_time.split(":"))
    end_hour, end_minute = (int(part) for part in end_time.split(":"))
    minutes = (end_hour * 60 + end_minute) - (start_hour * 60 + start_minute)
    return round(minutes / 60, 2)


def approve_leave_request(
    db: Session,
    request: LeaveRequest,
    admin: User,
    review_note: str | None,
    autofill_attendance: bool,
) -> None:
    request.status = "approved"
    request.review_note = review_note.strip() if review_note and review_note.strip() else None
    request.reviewed_by_id = admin.id

    if not autofill_attendance:
        return

    current_day = date_type.fromisoformat(request.start_date)
    end_day = date_type.fromisoformat(request.end_date)
    tag = f"[Leave request #{request.id}]"
    if request.duration_unit == "hours" and request.start_time and request.end_time:
        hours = duration_hours(request.start_time, request.end_time)
        hours_label = f"{hours:g} hour{'s' if hours != 1 else ''}"
        note = (
            f"{tag} {request.start_time}-{request.end_time} ({hours_label}): "
            f"{request.reason}"
        )[:1000]
    else:
        note = f"{tag} {request.reason}"[:1000]

    while current_day <= end_day:
        day = current_day.isoformat()
        record = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.team_member_id == request.team_member_id,
                AttendanceRecord.attendance_date == day,
            )
            .first()
        )
        if record is None:
            record = AttendanceRecord(
                team_member_id=request.team_member_id,
                attendance_date=day,
            )
            db.add(record)
        record.status = request.request_type
        if request.duration_unit == "days":
            record.check_in = None
            record.check_out = None
        record.notes = note
        record.recorded_by_id = admin.id
        record.leave_request_id = request.id
        current_day += timedelta(days=1)
    request.attendance_autofilled = 1
