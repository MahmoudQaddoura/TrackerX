from __future__ import annotations

"""Employee absence submissions and administrator review workflow."""

from datetime import date as date_type
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import LeaveRequest, TeamMember, User
from app.models.leave_request import (
    LEAVE_DURATION_UNITS,
    LEAVE_REQUEST_STATUSES,
    LEAVE_REQUEST_TYPES,
)
from app.schemas.leave_request import (
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveRequestReview,
)
from app.services.leave import approve_leave_request, duration_hours

router = APIRouter(prefix="/leave-requests", tags=["leave requests"])

_TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def _parse_date(value: str, label: str) -> date_type:
    try:
        return date_type.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{label} must use YYYY-MM-DD.")


def _member_for_user(db: Session, user: User) -> TeamMember:
    member = db.query(TeamMember).filter(TeamMember.user_id == user.id).first()
    if member is None or not bool(member.is_active):
        raise HTTPException(
            status_code=422,
            detail="This account is not linked to an active employee profile.",
        )
    return member


def _request_or_404(db: Session, request_id: int) -> LeaveRequest:
    request = db.get(LeaveRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    return request


def _duration_hours(start_time: str, end_time: str) -> float:
    return duration_hours(start_time, end_time)


def _serialize(request: LeaveRequest) -> dict:
    is_hourly = request.duration_unit == "hours"
    start = _parse_date(request.start_date, "Start date")
    end = _parse_date(request.end_date, "End date")
    offers = list(request.coverage_offers)
    return {
        "id": request.id,
        "team_member_id": request.team_member_id,
        "employee_number": request.team_member.employee_number,
        "employee_name": request.team_member.name,
        "employee_role": request.team_member.role,
        "request_type": request.request_type,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "duration_unit": request.duration_unit,
        "start_time": request.start_time,
        "end_time": request.end_time,
        "duration_days": None if is_hourly else (end - start).days + 1,
        "duration_hours": (
            _duration_hours(request.start_time, request.end_time)
            if is_hourly and request.start_time and request.end_time
            else None
        ),
        "reason": request.reason,
        "status": request.status,
        "review_note": request.review_note,
        "reviewed_by_name": request.reviewed_by.full_name if request.reviewed_by else None,
        "attendance_autofilled": bool(request.attendance_autofilled),
        "coverage_total": len(offers),
        "coverage_pending": sum(1 for offer in offers if offer.status == "pending"),
        "coverage_accepted": sum(1 for offer in offers if offer.status == "accepted"),
        "coverage_declined": sum(1 for offer in offers if offer.status == "declined"),
        "created_at": request.created_at,
        "updated_at": request.updated_at,
    }


@router.get("", response_model=list[LeaveRequestOut])
def list_leave_requests(
    scope: str = Query(default="mine", pattern="^(mine|all)$"),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if status is not None and status not in LEAVE_REQUEST_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid request status '{status}'.")

    query = db.query(LeaveRequest)
    if scope != "all" or user.role != "admin":
        member = _member_for_user(db, user)
        query = query.filter(LeaveRequest.team_member_id == member.id)
    if status is not None:
        query = query.filter(LeaveRequest.status == status)

    requests = query.order_by(LeaveRequest.created_at.desc(), LeaveRequest.id.desc()).all()
    requests.sort(key=lambda item: item.status != "pending")
    return [_serialize(request) for request in requests]


@router.post("", response_model=LeaveRequestOut, status_code=201)
def create_leave_request(
    inp: LeaveRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if inp.request_type not in LEAVE_REQUEST_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid request type '{inp.request_type}'.")
    if inp.duration_unit not in LEAVE_DURATION_UNITS:
        raise HTTPException(status_code=422, detail="Duration unit must be days or hours.")
    start = _parse_date(inp.start_date, "Start date")
    end = _parse_date(inp.end_date, "End date")
    if end < start:
        raise HTTPException(status_code=422, detail="End date cannot be before start date.")
    if inp.duration_unit == "days" and (end - start).days > 6:
        raise HTTPException(status_code=422, detail="A leave request can cover at most 7 days.")
    start_time = None
    end_time = None
    if inp.duration_unit == "hours":
        if start != end:
            raise HTTPException(status_code=422, detail="An hourly request must use one date.")
        if not inp.start_time or not _TIME_PATTERN.match(inp.start_time):
            raise HTTPException(status_code=422, detail="Start time must use HH:MM.")
        if not inp.end_time or not _TIME_PATTERN.match(inp.end_time):
            raise HTTPException(status_code=422, detail="End time must use HH:MM.")
        if _duration_hours(inp.start_time, inp.end_time) <= 0:
            raise HTTPException(status_code=422, detail="End time must be after start time.")
        start_time = inp.start_time
        end_time = inp.end_time

    member = _member_for_user(db, user)
    request = LeaveRequest(
        team_member_id=member.id,
        request_type=inp.request_type,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        duration_unit=inp.duration_unit,
        start_time=start_time,
        end_time=end_time,
        reason=inp.reason.strip(),
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _serialize(request)


@router.put("/{request_id}/review", response_model=LeaveRequestOut)
def review_leave_request(
    request_id: int,
    inp: LeaveRequestReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if inp.status not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="Review status must be approved or rejected.")
    if inp.status == "rejected" and inp.autofill_attendance:
        raise HTTPException(status_code=422, detail="Rejected requests cannot fill attendance.")

    request = _request_or_404(db, request_id)
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been reviewed.")

    if inp.status == "approved":
        approve_leave_request(
            db,
            request,
            admin,
            inp.review_note,
            inp.autofill_attendance,
        )
    else:
        request.status = "rejected"
        request.review_note = (
            inp.review_note.strip() if inp.review_note and inp.review_note.strip() else None
        )
        request.reviewed_by_id = admin.id

    db.commit()
    db.refresh(request)
    return _serialize(request)
