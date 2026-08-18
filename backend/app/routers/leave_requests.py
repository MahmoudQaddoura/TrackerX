from __future__ import annotations

"""Employee absence submissions and administrator review workflow."""

from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import AttendanceRecord, LeaveRequest, TeamMember, User
from app.models.leave_request import LEAVE_REQUEST_STATUSES, LEAVE_REQUEST_TYPES
from app.schemas.leave_request import (
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveRequestReview,
)

router = APIRouter(prefix="/leave-requests", tags=["leave requests"])


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


def _serialize(request: LeaveRequest) -> dict:
    return {
        "id": request.id,
        "team_member_id": request.team_member_id,
        "employee_name": request.team_member.name,
        "employee_role": request.team_member.role,
        "request_type": request.request_type,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "reason": request.reason,
        "status": request.status,
        "review_note": request.review_note,
        "reviewed_by_name": request.reviewed_by.full_name if request.reviewed_by else None,
        "attendance_autofilled": bool(request.attendance_autofilled),
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
    start = _parse_date(inp.start_date, "Start date")
    end = _parse_date(inp.end_date, "End date")
    if end < start:
        raise HTTPException(status_code=422, detail="End date cannot be before start date.")
    if (end - start).days > 30:
        raise HTTPException(status_code=422, detail="A single request can cover at most 31 days.")

    member = _member_for_user(db, user)
    request = LeaveRequest(
        team_member_id=member.id,
        request_type=inp.request_type,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
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

    request.status = inp.status
    request.review_note = inp.review_note.strip() if inp.review_note and inp.review_note.strip() else None
    request.reviewed_by_id = admin.id

    if inp.status == "approved" and inp.autofill_attendance:
        current_day = _parse_date(request.start_date, "Start date")
        end_day = _parse_date(request.end_date, "End date")
        tag = f"[Leave request #{request.id}]"
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
            record.check_in = None
            record.check_out = None
            record.notes = note
            record.recorded_by_id = admin.id
            record.leave_request_id = request.id
            current_day += timedelta(days=1)
        request.attendance_autofilled = 1

    db.commit()
    db.refresh(request)
    return _serialize(request)
