from __future__ import annotations

"""Leave coverage planning, employee notifications, and acceptance workflow."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db, now_iso
from app.deps import get_current_user, require_admin
from app.models import LeaveCoverageOffer, LeaveRequest, Task, TeamMember, User
from app.schemas.coverage import (
    CoverageAssignInput,
    CoverageAssignResult,
    CoverageOfferOut,
    CoveragePlanOut,
    CoverageResponseInput,
)
from app.services.leave import approve_leave_request
from app.services.risk import task_risk

router = APIRouter(tags=["leave coverage"])


def _request_or_404(db: Session, request_id: int) -> LeaveRequest:
    request = db.get(LeaveRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    return request


def _member_tasks(member: TeamMember) -> list[Task]:
    by_id = {
        task.id: task
        for task in [*member.assigned_tasks, *member.tasks]
        if task.status != "done"
    }
    return sorted(by_id.values(), key=lambda task: (task.end_date or "9999-99-99", task.id))


def _task_severity(task: Task) -> str:
    risk = task_risk(task)
    if bool(task.is_delayed) or risk == "overdue":
        return "critical"
    if task.status == "blocked" or risk == "at_risk":
        return "high"
    if task.status in ("in_progress", "in_review"):
        return "medium"
    return "low"


def _task_preview(task: Task) -> dict:
    milestone = task.milestone
    project = milestone.project
    return {
        "id": task.id,
        "title": task.title,
        "project_id": project.id,
        "project_name": project.name,
        "milestone_name": milestone.title,
        "status": task.status,
        "severity": _task_severity(task),
        "risk_level": task_risk(task),
        "due_date": task.end_date,
        "est_days": task.est_days,
    }


def _current_assignees(task: Task) -> list[TeamMember]:
    members = list(task.assigned_members)
    if not members and task.assigned_member:
        members = [task.assigned_member]
    return members


def _latest_offer_by_task(request: LeaveRequest) -> dict[int, LeaveCoverageOffer]:
    latest: dict[int, LeaveCoverageOffer] = {}
    for offer in request.coverage_offers:
        current = latest.get(offer.task_id)
        if current is None or (offer.created_at, offer.id) > (current.created_at, current.id):
            latest[offer.task_id] = offer
    return latest


def _active_offer_task_ids(request: LeaveRequest) -> set[int]:
    return {
        offer.task_id
        for offer in request.coverage_offers
        if offer.status in ("pending", "accepted")
    }


def _availability(
    db: Session,
    member: TeamMember,
    request: LeaveRequest,
) -> tuple[bool, str, str | None]:
    if member.user is None or not bool(member.user.is_enabled):
        return False, "no_login", "No enabled TrackerX login for coverage notifications."
    conflict = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.id != request.id,
            LeaveRequest.team_member_id == member.id,
            LeaveRequest.status.in_(("pending", "approved")),
            LeaveRequest.start_date <= request.end_date,
            LeaveRequest.end_date >= request.start_date,
        )
        .order_by(LeaveRequest.status.desc())
        .first()
    )
    if conflict:
        status = "on_leave" if conflict.status == "approved" else "leave_pending"
        return (
            False,
            status,
            f"{conflict.status.capitalize()} {conflict.request_type.replace('_', ' ')} "
            f"request overlaps {conflict.start_date} to {conflict.end_date}.",
        )
    return True, "available", None


def _candidate_out(db: Session, member: TeamMember, request: LeaveRequest) -> dict:
    tasks = _member_tasks(member)
    previews = [_task_preview(task) for task in tasks]
    high_count = sum(1 for task in previews if task["severity"] in ("critical", "high"))
    active_est_days = round(sum(float(task.est_days or 0) for task in tasks), 1)
    if len(tasks) >= 20 or active_est_days >= 40:
        workload = "high"
    elif len(tasks) >= 10 or active_est_days >= 20:
        workload = "balanced"
    else:
        workload = "light"
    eligible, availability, note = _availability(db, member, request)
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    previews.sort(key=lambda task: (severity_order[task["severity"]], task["due_date"] or "9999"))
    return {
        "id": member.id,
        "name": member.name,
        "role": member.role,
        "eligible": eligible,
        "availability": availability,
        "availability_note": note,
        "open_task_count": len(tasks),
        "high_severity_count": high_count,
        "active_est_days": active_est_days,
        "workload_level": workload,
        "current_tasks": previews[:8],
    }


def _offer_out(offer: LeaveCoverageOffer) -> dict:
    preview = _task_preview(offer.task)
    return {
        "id": offer.id,
        "leave_request_id": offer.leave_request_id,
        "task_id": offer.task_id,
        "task_title": offer.task.title,
        "project_id": preview["project_id"],
        "project_name": preview["project_name"],
        "milestone_name": preview["milestone_name"],
        "from_member_id": offer.from_member_id,
        "from_member_name": offer.from_member.name,
        "to_member_id": offer.to_member_id,
        "to_member_name": offer.to_member.name,
        "assigned_by_name": offer.assigned_by.full_name if offer.assigned_by else None,
        "status": offer.status,
        "severity": preview["severity"],
        "risk_level": preview["risk_level"],
        "due_date": preview["due_date"],
        "est_days": preview["est_days"],
        "leave_start_date": offer.leave_request.start_date,
        "leave_end_date": offer.leave_request.end_date,
        "admin_note": offer.admin_note,
        "response_note": offer.response_note,
        "created_at": offer.created_at,
        "responded_at": offer.responded_at,
    }


@router.get("/leave-requests/{request_id}/coverage-plan", response_model=CoveragePlanOut)
def coverage_plan(
    request_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    request = _request_or_404(db, request_id)
    source_tasks = _member_tasks(request.team_member)
    latest = _latest_offer_by_task(request)
    tasks = []
    for task in source_tasks:
        current_members = _current_assignees(task)
        other_members = [member for member in current_members if member.id != request.team_member_id]
        offer = latest.get(task.id)
        tasks.append(
            {
                **_task_preview(task),
                "current_assignees": [member.name for member in current_members],
                "requires_assignment": not other_members and not (
                    offer and offer.status in ("pending", "accepted")
                ),
                "coverage_status": offer.status if offer else None,
                "coverage_assignee_id": offer.to_member_id if offer else None,
                "coverage_assignee_name": offer.to_member.name if offer else None,
            }
        )
    candidates = [
        _candidate_out(db, member, request)
        for member in db.query(TeamMember)
        .filter(
            TeamMember.is_active == 1,
            TeamMember.id != request.team_member_id,
            TeamMember.role != "Owner",
        )
        .order_by(TeamMember.name)
        .all()
    ]
    candidates.sort(
        key=lambda member: (
            not member["eligible"],
            member["workload_level"] == "high",
            member["active_est_days"],
            member["name"],
        )
    )
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    tasks.sort(key=lambda task: (severity_order[task["severity"]], task["due_date"] or "9999"))
    return {
        "leave_request_id": request.id,
        "employee_id": request.team_member_id,
        "employee_name": request.team_member.name,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "duration_unit": request.duration_unit,
        "reason": request.reason,
        "request_status": request.status,
        "tasks": tasks,
        "candidates": candidates,
    }


@router.post("/leave-requests/{request_id}/coverage", response_model=CoverageAssignResult)
def assign_leave_coverage(
    request_id: int,
    inp: CoverageAssignInput,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    request = _request_or_404(db, request_id)
    if request.status not in ("pending", "approved"):
        raise HTTPException(status_code=409, detail="Coverage cannot be assigned to this request.")

    source_tasks = {task.id: task for task in _member_tasks(request.team_member)}
    assignment_ids = [assignment.task_id for assignment in inp.assignments]
    if len(assignment_ids) != len(set(assignment_ids)):
        raise HTTPException(status_code=422, detail="Each task can have only one coverage recipient.")
    unknown_tasks = set(assignment_ids) - set(source_tasks)
    if unknown_tasks:
        raise HTTPException(status_code=422, detail="A selected task is not assigned to this employee.")

    active_offer_ids = _active_offer_task_ids(request)
    if request.status == "pending":
        required_ids = {
            task.id
            for task in source_tasks.values()
            if not [member for member in _current_assignees(task) if member.id != request.team_member_id]
            and task.id not in active_offer_ids
        }
        missing = required_ids - set(assignment_ids)
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Assign coverage for all {len(required_ids)} required task(s) before approving leave.",
            )

    candidates = {
        member.id: member
        for member in db.query(TeamMember)
        .filter(
            TeamMember.is_active == 1,
            TeamMember.id != request.team_member_id,
            TeamMember.role != "Owner",
        )
        .all()
    }
    created: list[LeaveCoverageOffer] = []
    for assignment in inp.assignments:
        if assignment.task_id in active_offer_ids:
            raise HTTPException(status_code=409, detail="A selected task already has active coverage.")
        candidate = candidates.get(assignment.to_member_id)
        if candidate is None:
            raise HTTPException(status_code=422, detail="A selected coverage employee is unavailable.")
        eligible, _, note = _availability(db, candidate, request)
        if not eligible:
            raise HTTPException(status_code=422, detail=note or "A selected employee is unavailable.")
        offer = LeaveCoverageOffer(
            leave_request_id=request.id,
            task_id=assignment.task_id,
            from_member_id=request.team_member_id,
            to_member_id=candidate.id,
            assigned_by_id=admin.id,
            admin_note=inp.coverage_note.strip() if inp.coverage_note and inp.coverage_note.strip() else None,
        )
        db.add(offer)
        created.append(offer)

    if request.status == "pending":
        approve_leave_request(
            db,
            request,
            admin,
            inp.review_note,
            inp.autofill_attendance,
        )
    db.commit()
    for offer in created:
        db.refresh(offer)
    return {
        "leave_request_id": request.id,
        "leave_status": request.status,
        "offers_created": len(created),
        "offers": [_offer_out(offer) for offer in created],
    }


@router.get("/coverage-offers/mine", response_model=list[CoverageOfferOut])
def my_coverage_offers(
    status: str = Query(default="pending", pattern="^(pending|accepted|declined|all)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    member = db.query(TeamMember).filter(TeamMember.user_id == user.id).first()
    if member is None:
        return []
    query = db.query(LeaveCoverageOffer).filter(LeaveCoverageOffer.to_member_id == member.id)
    if status != "all":
        query = query.filter(LeaveCoverageOffer.status == status)
    offers = query.order_by(LeaveCoverageOffer.created_at.desc(), LeaveCoverageOffer.id.desc()).all()
    return [_offer_out(offer) for offer in offers]


@router.patch("/coverage-offers/{offer_id}/respond", response_model=CoverageOfferOut)
def respond_to_coverage_offer(
    offer_id: int,
    inp: CoverageResponseInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if inp.action not in ("accepted", "declined"):
        raise HTTPException(status_code=422, detail="Response must be accepted or declined.")
    member = db.query(TeamMember).filter(TeamMember.user_id == user.id).first()
    offer = db.get(LeaveCoverageOffer, offer_id)
    if member is None or offer is None or offer.to_member_id != member.id:
        raise HTTPException(status_code=404, detail="Coverage request not found.")
    if offer.status != "pending":
        raise HTTPException(status_code=409, detail="This coverage request has already been answered.")

    if inp.action == "accepted":
        if offer.task.status == "done":
            raise HTTPException(status_code=409, detail="This task was completed before coverage was accepted.")
        members = [
            assigned
            for assigned in _current_assignees(offer.task)
            if assigned.id != offer.from_member_id
        ]
        if all(assigned.id != member.id for assigned in members):
            members.append(member)
        offer.task.assigned_members = members
        offer.task.assigned_member_id = members[0].id if members else None

    offer.status = inp.action
    offer.response_note = (
        inp.response_note.strip() if inp.response_note and inp.response_note.strip() else None
    )
    offer.responded_at = now_iso()
    db.commit()
    db.refresh(offer)
    return _offer_out(offer)
