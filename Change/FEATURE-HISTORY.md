# TrackerX — consolidated feature and change history

Audit baseline: 5 September 2026. This inventory is reconstructed from the application source, existing change notes, and the product decisions in this task. It describes implemented capabilities; it is not a claim that every workflow has passed end-to-end testing. The audit reports in this folder record verification separately.

## Identity and staff

- TrackerX branding, company blue palette, role-aware navigation, owner badge, and personal profile entry.
- Owner, administrator, project manager, developer/employee, and client access paths; primary-owner controls for privileged roles.
- Employee directory, enabled/disabled logins, temporary credentials, required password replacement, project assignments, task delegation.
- Employee profiles with English/Arabic names, role descriptions, current projects, private CV/profile uploads, previews, and downloads.
- Persistent four-digit employee numbers; owner 0001 and Yazan 0002; numbers included in attendance and leave reporting.
- One owner-selected project manager per project through the project menu; the employee leadership panel and assistant-PM selection were removed.
- Self-service password changes are available from every signed-in employee profile, while temporary-password replacement remains mandatory before workspace access.
- Project managers organize a separate employee roster for each project they lead. A manager may lead multiple projects without merging their teams, and task assignment is limited to the selected project roster.
- Persistent in-app notifications connect managers and employees: project/team assignments notify employees, and employee task-status updates notify the responsible project manager.

## Project delivery

- Actual delivery projects and linked Maintenance & Support workspaces, including VerifyX-PSUT and VerifyX Maintenance & Support.
- Project overview, milestone/task progress, delay/risk indicators, assignees, project GitHub links.
- Kanban, milestone-grouped Gantt, workstreams, CSV import, task comments, multiple assignees, task status updates.
- Progressive Kanban milestones: the current stage opens by default, fully completed stages collapse with a Done state, and the next ordered stage opens automatically. Milestone/task forms use guided outcome, ownership, schedule, status, and delay sections with milestone-bound date validation.
- Dashboard project-progress presentation, reduced dashboard clutter, and task/milestone inspection.
- Project documents grouped by category and milestone, uploads, safe previews, downloads, metadata editing; meeting records.

## Attendance, leave, and coverage

- One daily employee sheet with present/absent recording, autofill/bulk attendance, optional times and notes, date navigation.
- Daily PDF attendance sheet and monthly days-off/leave PDF report, employee ID columns, Blockexe branding and Yu Gothic styling where the font is available.
- Full-day/hourly leave requests; assign, approve, and reject actions and review notes.
- Coverage considers the requested absence interval, task urgency, candidate workload, and availability.
- Coverage offers notify the selected employee; task ownership changes after acceptance.
- Separate daily attendance, request inbox, and coverage inbox; redundant header removed.
- Attendance and leave are company-wide only for administrators; project managers and employees see only their own attendance and requests.

## Asset inventory

- Project-owned asset register for actual and maintenance projects; manual creation, editing, duplication/data-entry support, filtering, and expanded workspace.
- Environment, hostname/IP, system/resources, applications/services, destination ports, and lifecycle status.
- Connectivity matrix derived from registered assets and ports; each destination port has its own connection state for each source.
- PDF and Excel download formats under a common export control, including inventory and connectivity matrix; Excel replaced the earlier XML request.
- Demo register data is explicitly sample infrastructure, not a network discovery result.
- Employee/client access follows project permissions; authorized exports include the full register.

## Maintenance and client delivery

- Proactive service reports: categories/custom service names, periods, assignees, findings, work completed, recommendations, completion validation, PDF export.
- Reactive incidents: team/client detection source, initial evidence/impact, triage, investigation, response, recovery, closure, lessons learned, PDF export.
- Explicit forwarding of finalized reports to client accounts, report inbox/read state, and revocation.
- Maintenance documents moved into a Documents tab alongside proactive/reactive tasks and assets.
- Client administration: organization/contact profiles, access assignments, enabled logins, forwarding history.
- Client portal: approved project details and inherited linked support workspaces. PSUT's VerifyX assignment includes VerifyX Maintenance & Support automatically; inherited grants are distinguished from direct grants.
- Internal staff assignments and non-forwarded service reports have separate client disclosure rules.

## Persistence and operations

- SQLite application data; selectable local or S3-compatible/MinIO document storage; portable, traversal-safe storage keys; preservation/recovery helpers; checksummed database-and-upload backups with retention.
- Additive compatibility migrations for existing databases, fresh-install administrator bootstrap.
- Containerized FastAPI backend and nginx frontend, private backend network, persistent data/backups, health checks and deployment guide.
- Source organized into backend models/schemas/routers/services and frontend API/hooks/context/pages/feature components.

## This audit

Reference structure: SECURITY-AUDIT-REPORT-AI-Tutor-2026-08-22.html and ENGINEERING-AUDIT-REPORT-AI-Tutor-2026-08-22.html supplied by the owner. Their findings concern another application and are not treated as TrackerX evidence. TrackerX has no runtime LLM/RAG service; those reference sections are assessed as not applicable.

See the companion security, engineering, remediation, and release-readiness reports in this folder for the current audit's actual findings and evidence.
