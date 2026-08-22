from __future__ import annotations

"""Idempotently move VerifyX operational data into its support workspace."""

from app.db import SessionLocal
from app.models import Project, ProactiveServiceReport, TeamMember, User
from app.models.support import PROACTIVE_CATEGORY_TEMPLATES

ACTUAL_PROJECT_NAME = "VerifyX-PSUT"
SUPPORT_PROJECT_NAME = "VerifyX Maintenance & Support"


def migrate() -> dict[str, int | str]:
    with SessionLocal() as db:
        actual = (
            db.query(Project)
            .filter(
                Project.name == ACTUAL_PROJECT_NAME,
                Project.project_type == "actual_project",
            )
            .first()
        )
        if actual is None:
            raise RuntimeError(f"Actual project '{ACTUAL_PROJECT_NAME}' was not found.")

        support = (
            db.query(Project)
            .filter(
                Project.parent_project_id == actual.id,
                Project.project_type == "maintenance_support",
            )
            .order_by(Project.id)
            .first()
        )
        if support is None:
            support = Project(
                name=SUPPORT_PROJECT_NAME,
                description=(
                    "Ongoing service assurance, operational reporting, incident response, "
                    "and client support for VerifyX at PSUT."
                ),
                status="active",
                project_type="maintenance_support",
                parent_project_id=actual.id,
            )
            db.add(support)
            db.flush()
        elif support.name.lower() == "test":
            support.name = SUPPORT_PROJECT_NAME
            support.description = (
                "Ongoing service assurance, operational reporting, incident response, "
                "and client support for VerifyX at PSUT."
            )

        admin = db.query(User).filter(User.role == "admin").order_by(User.id).first()
        existing_by_category = {report.category: report for report in support.proactive_reports}
        created_reports = 0
        for category, title in PROACTIVE_CATEGORY_TEMPLATES:
            if category in existing_by_category:
                continue
            report = ProactiveServiceReport(
                project_id=support.id,
                category=category,
                title=title,
                status="pending",
                created_by_id=admin.id if admin else None,
            )
            db.add(report)
            db.flush()
            existing_by_category[category] = report
            created_reports += 1

        delivery_owner = (
            db.query(TeamMember).filter(TeamMember.name == "Yazan Abu Osbeh").first()
        )
        security_owner = (
            db.query(TeamMember).filter(TeamMember.name == "Mohammad AlBalawi").first()
        )
        training_owner = db.query(TeamMember).filter(TeamMember.name == "Lina Khalil").first()

        for category in ("health_check", "patch_update", "performance", "kpi"):
            report = existing_by_category[category]
            if delivery_owner and not report.assignees:
                report.assignees = [delivery_owner]
        penetration_report = existing_by_category["penetration_testing"]
        if security_owner and not penetration_report.assignees:
            penetration_report.assignees = [security_owner]

        operations_milestones = [
            milestone for milestone in actual.milestones if milestone.workstream == "operations"
        ]
        completed_operations = [
            task.title
            for milestone in operations_milestones
            for task in milestone.tasks
            if task.status == "done"
        ]
        updates_report = existing_by_category["updates"]
        if completed_operations and not updates_report.executive_summary:
            updates_report.status = "completed"
            updates_report.executive_summary = (
                "VerifyX handover and training activities were completed to introduce the "
                "platform, explain its workflows and roles, and provide initial operational guidance."
            )
            updates_report.findings = (
                "The completed handover confirms that the initial operational knowledge transfer "
                "and user guidance were delivered. Recurring service assurance should now be "
                "tracked through the Maintenance & Support workspace."
            )
            updates_report.work_completed = "\n".join(
                f"- {title}" for title in completed_operations
            )
            updates_report.recommendations = (
                "Maintain the user and technical manuals, schedule recurring health and KPI reviews, "
                "and record every future change or incident in TrackerX."
            )
            if training_owner and not updates_report.assignees:
                updates_report.assignees = [training_owner]

        moved_documents = 0
        for document in list(actual.documents):
            if not (document.description or "").startswith(
                "[trackerx-document] collection=operations;"
            ):
                continue
            document.project_id = support.id
            document.milestone_id = None
            moved_documents += 1

        db.commit()
        return {
            "actual_project_id": actual.id,
            "support_project_id": support.id,
            "support_project_name": support.name,
            "created_reports": created_reports,
            "moved_documents": moved_documents,
        }


if __name__ == "__main__":
    print(migrate())
