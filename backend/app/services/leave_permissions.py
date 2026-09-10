from __future__ import annotations

"""Single permission boundary for leave review, routing, and notifications."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import LeaveRequest, TeamMember, User


def member_for_user(db: Session, user: User) -> TeamMember:
    member = db.query(TeamMember).filter(TeamMember.user_id == user.id).first()
    if member is None or not bool(member.is_active):
        raise HTTPException(
            status_code=422,
            detail="This account is not linked to an active employee profile.",
        )
    return member


def can_review_leave_request(db: Session, reviewer: User, request: LeaveRequest) -> bool:
    """Owners review privileged staff; admins and accountable PMs review employees."""

    requester_user = request.team_member.user
    if requester_user is not None and requester_user.id == reviewer.id:
        return False
    requester_role = requester_user.role if requester_user is not None else "developer"

    if requester_role == "admin" and bool(requester_user and requester_user.is_primary_admin):
        return reviewer.role == "admin"
    if requester_role in ("admin", "pm"):
        return reviewer.role == "admin" and bool(reviewer.is_primary_admin)
    if reviewer.role == "admin":
        return True
    if reviewer.role != "pm" or reviewer.access_level != "write":
        return False

    reviewer_member = db.query(TeamMember).filter(TeamMember.user_id == reviewer.id).first()
    if reviewer_member is None or not bool(reviewer_member.is_active):
        return False
    managed_ids = {
        project.id
        for project in reviewer_member.managed_projects
        if project.status not in ("completed", "archived")
    }
    requester_project_ids = {
        project.id
        for project in request.team_member.assigned_projects
        if project.status not in ("completed", "archived")
    }
    # A PM may approve only when they are accountable for every active project
    # in the employee's scope. Cross-project leave stays with administrators so
    # one manager cannot approve time away from another manager's workstream.
    return bool(requester_project_ids) and requester_project_ids <= managed_ids


def require_leave_review_access(db: Session, reviewer: User, request: LeaveRequest) -> None:
    if not can_review_leave_request(db, reviewer, request):
        raise HTTPException(
            status_code=403,
            detail="You are not the authorized reviewer for this leave request.",
        )


def reviewable_leave_requests(db: Session, reviewer: User) -> list[LeaveRequest]:
    if reviewer.role not in ("admin", "pm"):
        return []
    return [
        request
        for request in db.query(LeaveRequest).all()
        if can_review_leave_request(db, reviewer, request)
    ]


def leave_reviewer_members(db: Session, requester: TeamMember) -> list[TeamMember]:
    """Return enabled people who should be notified when this member requests leave."""

    requester_role = requester.user.role if requester.user is not None else "developer"
    members = db.query(TeamMember).filter(TeamMember.is_active == 1).all()
    if requester_role == "admin" and bool(requester.user and requester.user.is_primary_admin):
        return [
            member
            for member in members
            if member.user is not None
            and member.user.role == "admin"
            and bool(member.user.is_enabled)
        ]
    if requester_role in ("admin", "pm"):
        return [
            member
            for member in members
            if member.user is not None
            and member.user.role == "admin"
            and bool(member.user.is_primary_admin)
            and bool(member.user.is_enabled)
        ]

    assigned_ids = {project.id for project in requester.assigned_projects}
    recipients: list[TeamMember] = []
    for member in members:
        if member.user is None or not bool(member.user.is_enabled):
            continue
        if member.user.role == "admin":
            recipients.append(member)
            continue
        if member.user.role == "pm" and member.user.access_level == "write":
            managed_ids = {project.id for project in member.managed_projects}
            if assigned_ids and assigned_ids <= managed_ids:
                recipients.append(member)
    return recipients
