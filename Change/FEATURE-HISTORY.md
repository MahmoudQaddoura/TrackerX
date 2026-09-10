# TrackerX — consolidated feature and change history

Audit baseline: 5 September 2026. This inventory is reconstructed from the application source, existing change notes, and the product decisions in this task. It describes implemented capabilities; it is not a claim that every workflow has passed end-to-end testing. The audit reports in this folder record verification separately.

## Identity and staff

- TrackerX branding, company blue palette, role-aware navigation, owner badge, and personal profile entry.
- Owner, administrator, project manager, developer/employee, and client access paths; primary-owner controls for privileged roles.
- Employee directory, enabled/disabled logins, temporary credentials, required password replacement, project assignments, task delegation.
- Employee profiles with English/Arabic names, role descriptions, current projects, private CV/profile uploads, previews, and downloads.
- Employees can upload and remove files on their own private profile; administrators retain company-wide profile-file management. Other employees, project managers, and clients cannot access another employee's private files.
- Persistent four-digit employee numbers; owner 0001 and Yazan 0002; numbers included in attendance and leave reporting.
- One owner-selected project lead per project, chosen from eligible Administrators or Project Managers; the employee leadership panel and assistant-PM selection were removed.
- Self-service password changes are available from every signed-in employee profile, while temporary-password replacement remains mandatory before workspace access.
- Project managers organize a separate employee roster for each project they lead. A manager may lead multiple projects without merging their teams, and task assignment is limited to the selected project roster.
- Persistent in-app notifications connect managers and employees: project/team assignments notify employees, and employee task-status updates notify the responsible project manager.
- Workforce control center: a filterable structured roster separates job role, employment type, weekly hours, workload, workspace scope, login permission, and project leadership. Employment types support full-time, part-time, contractor, and intern records.
- Project leadership is owner-only and accepts either an active Administrator login or an active Project Manager login with write permission. The owner may lead projects directly, and one lead may manage multiple projects. Active leadership assignments must be reassigned before the employee can be demoted, disabled, or deactivated.
- The project portfolio now uses a TrackerX command-center layout with live leadership coverage, delivery progress, attention indicators, searchable project cards, clear project-lead controls, and direct workspace actions.

## Project delivery

- Actual delivery projects and linked Maintenance & Support workspaces, including VerifyX-PSUT and VerifyX Maintenance & Support.
- Project overview, milestone/task progress, delay/risk indicators, assignees, project GitHub links.
- Kanban, milestone-grouped Gantt, workstreams, CSV import, task comments, multiple assignees, task status updates.
- Progressive Kanban milestones: the current stage opens by default, fully completed stages collapse with a Done state, and the next ordered stage opens automatically. Milestone/task forms use guided outcome, ownership, schedule, status, and delay sections with milestone-bound date validation.
- Dashboard project-progress presentation, reduced dashboard clutter, and task/milestone inspection.
- Project documents grouped by category and milestone, uploads, safe previews, downloads, metadata editing; meeting records.

## Attendance, leave, and coverage

- One live daily employee register with self-service office/remote check-in and check-out, server-controlled Amman timestamps, automatic five-second team refresh, optional notes, and a separate administrator exception-correction mode.
- Daily PDF attendance sheet and monthly days-off/leave PDF report with employee ID and role columns, Blockexe branding, and Yu Gothic styling where the font is available.
- Full-day/hourly leave requests with role-aware routing: employees notify accountable PMs and admins; PM/non-owner administrator leave requires owner review; owner leave routes to another administrator. No requester can approve their own leave.
- Coverage considers the requested absence interval, task urgency, candidate workload, and availability.
- Coverage offers notify the selected employee; task ownership changes after acceptance.
- Separate personal confirmation, team attendance, leave center, and coverage inbox views in a TrackerX attendance control center. Personal confirmation is also embedded in every internal user's own profile.
- Approved leave automatically owns and protects the corresponding attendance row. Unresolved employees remain clearly marked as Awaiting check-in until an authorized exception is recorded; TrackerX never invents vacation without an approved request.
- Administrators retain company-wide attendance; PMs review leave only when they own the employee's complete active project scope; employees see their own records; clients are denied attendance and leave access.

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
- API integrity regression coverage validates all OpenAPI method/path registrations plus complete milestone and meeting create/edit/delete workflows, preventing missing authorization dependencies from reaching production.
- Production reliability controls add schema-aware readiness, SQLite integrity/concurrency settings, request IDs, controlled database 503 responses, one-minute automatic health recovery, daily verified backups, and test-database isolation.
- Security remediation adds zero-finding Bandit enforcement, protected Office XML previews, production guards around destructive demo tooling, owner-only database/backup permissions, compromised demo-credential rotation, key-only SSH, and an inbound deny-by-default firewall.
- Concurrent-use hardening adds a bounded 100-request admission limit, a 2,048-connection backlog, a 20+20 database pool, five-second single-flight readiness caching, explicit memory/file/task resource ceilings, two-second crash recovery, and a repeatable external concurrency gate with percentile latency and zero-error enforcement.

## This audit

Reference structure: SECURITY-AUDIT-REPORT-AI-Tutor-2026-08-22.html and ENGINEERING-AUDIT-REPORT-AI-Tutor-2026-08-22.html supplied by the owner. Their findings concern another application and are not treated as TrackerX evidence. TrackerX has no runtime LLM/RAG service; those reference sections are assessed as not applicable.

See the companion security, engineering, remediation, and release-readiness reports in this folder for the current audit's actual findings and evidence.
