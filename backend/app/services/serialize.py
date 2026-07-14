"""
services/serialize.py
Turn ORM instances into response dicts, filling in computed fields
(progress, delay, risk, display names). One purpose: presentation shaping.
Keeps computation out of the routers so every endpoint returns identical shapes.
"""

from __future__ import annotations

from app.services import progress as prog
from app.services.risk import task_risk, worst_risk


def task_out(task) -> dict:
    """Serialize a Task, including its computed risk level and assignee name."""
    member = task.assigned_member
    team = member.team if member else None
    return {
        "id": task.id,
        "milestone_id": task.milestone_id,
        "title": task.title,
        "description": task.description,
        "start_date": task.start_date,
        "end_date": task.end_date,
        "status": task.status,
        "is_delayed": bool(task.is_delayed),
        "delay_cause": task.delay_cause,
        "delay_comment": task.delay_comment,
        "est_days": task.est_days,
        "assigned_member_id": task.assigned_member_id,
        "assigned_member_name": member.name if member else None,
        "assigned_team_id": team.id if team else None,
        "assigned_team_name": team.name if team else None,
        "sort_order": task.sort_order,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "risk_level": task_risk(task),
    }


def milestone_out(ms) -> dict:
    """Serialize a Milestone with task roll-ups and worst-case risk."""
    r = prog.rollup(ms.tasks)
    return {
        "id": ms.id,
        "project_id": ms.project_id,
        "title": ms.title,
        "description": ms.description,
        "start_date": ms.start_date,
        "end_date": ms.end_date,
        "sort_order": ms.sort_order,
        "created_at": ms.created_at,
        "updated_at": ms.updated_at,
        "total_tasks": r["total_tasks"],
        "done_tasks": r["done_tasks"],
        "progress_pct": r["progress_pct"],
        "is_delayed": r["is_delayed"],
        "risk_level": worst_risk(ms.tasks),
    }


def project_out(project) -> dict:
    """Serialize a Project with portfolio roll-ups across all its tasks."""
    tasks = prog.project_tasks(project)
    r = prog.rollup(tasks)
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "start_date": project.start_date,
        "end_date": project.end_date,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "milestone_count": len(project.milestones),
        "total_tasks": r["total_tasks"],
        "done_tasks": r["done_tasks"],
        "progress_pct": r["progress_pct"],
        "is_delayed": r["is_delayed"],
        "risk_level": worst_risk(tasks),
    }


def team_member_out(member) -> dict:
    return {
        "id": member.id,
        "name": member.name,
        "role": member.role,
        "is_active": bool(member.is_active),
        "task_count": len(member.tasks),
        "team_id": member.team_id,
        "team_name": member.team.name if member.team else None,
        "user_id": member.user_id,
        "has_login": member.user_id is not None,
        "created_at": member.created_at,
        "updated_at": member.updated_at,
    }


def team_out(team) -> dict:
    """Serialize a Team with project links and a workload/capacity roll-up."""
    active_days = sum(
        (m.est_days or 0)
        for member in team.members
        for m in member.tasks
        if m.status != "done"
    )
    total_tasks = sum(len(member.tasks) for member in team.members)
    load_pct = (
        round((active_days / team.weekly_capacity_days) * 100, 1)
        if team.weekly_capacity_days
        else None
    )
    return {
        "id": team.id,
        "name": team.name,
        "function": team.function,
        "lead_user_id": team.lead_user_id,
        "lead_name": team.lead.full_name if team.lead else None,
        "weekly_capacity_days": team.weekly_capacity_days,
        "created_at": team.created_at,
        "updated_at": team.updated_at,
        "project_ids": [p.id for p in team.projects],
        "project_names": [p.name for p in team.projects],
        "member_count": len(team.members),
        "total_tasks": total_tasks,
        "active_task_est_days": active_days,
        "load_pct": load_pct,
    }


def document_out(doc) -> dict:
    return {
        "id": doc.id,
        "project_id": doc.project_id,
        "milestone_id": doc.milestone_id,
        "category": doc.category,
        "title": doc.title,
        "description": doc.description,
        "file_name": doc.file_name,
        "content_type": doc.content_type,
        "file_size": doc.file_size,
        "uploaded_by_id": doc.uploaded_by_id,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }


def comment_out(comment) -> dict:
    author = comment.author
    return {
        "id": comment.id,
        "entity_type": comment.entity_type,
        "entity_id": comment.entity_id,
        "author_id": comment.author_id,
        "author_name": author.full_name if author else "Unknown",
        "author_role": author.role if author else "client",
        "body": comment.body,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }
