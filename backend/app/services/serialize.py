"""
services/serialize.py
Turn ORM instances into response dicts, filling in computed fields
(progress, delay, risk, display names). One purpose: presentation shaping.
Keeps computation out of the routers so every endpoint returns identical shapes.
"""

from __future__ import annotations

from app.services import progress as prog
from app.services.risk import task_risk, worst_risk


def task_out(task, include_assignees: bool = True) -> dict:
    """Serialize a task, with employee identity removed for client-facing reads."""
    members = list(task.assigned_members)
    if not members and task.assigned_member:
        members = [task.assigned_member]
    primary_member = task.assigned_member if task.assigned_member in members else (members[0] if members else None)
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
        "assigned_member_id": primary_member.id if primary_member and include_assignees else None,
        "assigned_member_name": primary_member.name if primary_member and include_assignees else None,
        "assigned_members": [
            {"id": member.id, "name": member.name, "role": member.role}
            for member in members
        ] if include_assignees else [],
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
        "workstream": ms.workstream,
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
    support_workspace = next(
        (
            candidate
            for candidate in project.support_projects
            if candidate.project_type == "maintenance_support"
            and candidate.status not in ("completed", "archived")
        ),
        None,
    )
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "project_type": project.project_type,
        "parent_project_id": project.parent_project_id,
        "parent_project_name": project.parent_project.name if project.parent_project else None,
        "project_manager_id": project.project_manager_id,
        "project_manager_name": project.project_manager.name if project.project_manager else None,
        "support_workspace_id": support_workspace.id if support_workspace else None,
        "support_workspace_name": support_workspace.name if support_workspace else None,
        "start_date": project.start_date,
        "end_date": project.end_date,
        "github_repo_url": project.github_repo_url,
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
    # Combine projects explicitly assigned by an administrator with legacy
    # task-linked access. The source is returned so the UI can explain why an
    # employee can open a workspace.
    project_map: dict[int, dict] = {}
    assigned_project_ids = {project.id for project in member.assigned_projects}
    for project in member.assigned_projects:
        rollup = prog.rollup(prog.project_tasks(project))
        project_map[project.id] = {
            "id": project.id,
            "name": project.name,
            "status": project.status,
            "project_type": project.project_type,
            "progress_pct": rollup["progress_pct"],
            "total_tasks": rollup["total_tasks"],
            "done_tasks": rollup["done_tasks"],
            "assignment_source": "admin",
            "leadership_role": None,
        }
    for project in member.managed_projects:
        rollup = prog.rollup(prog.project_tasks(project))
        item = project_map.setdefault(
            project.id,
            {
                "id": project.id,
                "name": project.name,
                "status": project.status,
                "project_type": project.project_type,
                "progress_pct": rollup["progress_pct"],
                "total_tasks": rollup["total_tasks"],
                "done_tasks": rollup["done_tasks"],
                "assignment_source": "leadership",
                "leadership_role": None,
            },
        )
        item["leadership_role"] = "project_manager"
    total_est = 0.0
    tasks = list(member.assigned_tasks)
    for t in tasks:
        if t.milestone and t.milestone.project:
            pid = t.milestone.project.id
            if pid in project_map:
                project_map[pid]["assignment_source"] = "admin_and_task"
            else:
                project = t.milestone.project
                rollup = prog.rollup(prog.project_tasks(project))
                project_map[pid] = {
                    "id": pid,
                    "name": project.name,
                    "status": project.status,
                    "project_type": project.project_type,
                    "progress_pct": rollup["progress_pct"],
                    "total_tasks": rollup["total_tasks"],
                    "done_tasks": rollup["done_tasks"],
                    "assignment_source": "task",
                    "leadership_role": None,
                }
        if t.status != "done" and t.est_days:
            total_est += t.est_days
    projects = sorted(project_map.values(), key=lambda project: project["name"].lower())
    return {
        "id": member.id,
        "name": member.name,
        "name_arabic": member.name_arabic,
        "role": member.role,
        "role_description": member.role_description,
        "is_active": bool(member.is_active),
        "task_count": len(tasks),
        "total_tasks": len(tasks),
        "done_tasks": sum(1 for t in tasks if t.status == "done"),
        "active_est_days": round(total_est, 1),
        "projects": projects,
        "assigned_project_ids": sorted(assigned_project_ids),
        "user_id": member.user_id,
        "has_login": member.user_id is not None,
        "login_email": member.user.email if member.user else None,
        "account_role": member.user.role if member.user else None,
        "is_primary_admin": bool(member.user.is_primary_admin) if member.user else False,
        "access_level": (
            "write" if member.user and member.user.role == "admin" else member.user.access_level
            if member.user
            else None
        ),
        "login_enabled": bool(member.user.is_enabled) if member.user else False,
        "profile_file_count": len(member.profile_files),
        "created_at": member.created_at,
        "updated_at": member.updated_at,
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
