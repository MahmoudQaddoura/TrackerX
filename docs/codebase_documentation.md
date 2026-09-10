# Codebase Documentation — Project Task Tracker

A full-stack project management tool: **FastAPI + SQLite** backend and a **React + TypeScript (Vite)** frontend. Projects → Milestones → Tasks, plus workforce management, attendance and leave, asset inventory, service reporting, client delivery, documents, meetings, dashboards, and Gantt timelines. The permission model distinguishes the owner/primary administrator, administrators, project managers, employees, and clients.

Design principle carried over from the original prototype: **one file, one purpose**, fully documented. This file is the map.

For the data model see [`database_documentation.md`](database_documentation.md). For running/containerizing/deploying see [`GUIDE.md`](GUIDE.md).

```
Prototype/
├── backend/            FastAPI + SQLite API
├── frontend/           React + Vite + TS single-page app
├── data/               sample_project.csv (reference for CSV import)
├── scripts/            xlsx_to_csv.py (convert the plan spreadsheet to CSV)
├── docker-compose.yml  full-stack container setup
├── codebase_documentation.md   (this file)
├── database_documentation.md
└── GUIDE.md
```

---

## Backend — `backend/app/`

### Core

| File | Purpose |
|------|---------|
| `main.py` | App assembly: CORS, mounts every router under `/api`, creates tables on startup, `/api/health`. |
| `config.py` | `Settings` (pydantic-settings) — DB URL, JWT secret/algorithm/expiry, documents dir, max upload size, CORS origins. Exposes cached `settings`. |
| `db.py` | SQLAlchemy `engine`, `SessionLocal`, declarative `Base`, `get_db()` request dependency, `now_iso()` timestamp helper. |
| `security.py` | `hash_password` / `verify_password` (bcrypt); `create_access_token` / `decode_access_token` (HS256 JWT carrying `sub` + `role`). |
| `deps.py` | `get_current_user` (401 if no/invalid token) and `require_pm` (403 for owners) FastAPI dependencies. |
| `bootstrap.py` | Validates production secrets and creates the first temporary-password administrator only when the users table is empty. |
| `load_sample_project.py` / `seed_roles.py` | Optional local-development sample projects and demo-role accounts. These are never run automatically in production. |

### Models — `models/` (one table per file)

| File | Table | Notes |
|------|-------|-------|
| `user.py` | `users` | Auth accounts. `role IN ('pm','owner')`. |
| `project.py` | `projects` | `status IN ('active','on_hold','completed','archived')`. Cascades to milestones/meetings/documents. |
| `milestone.py` | `milestones` | Belongs to a project; owns tasks and documents. |
| `task.py` | `tasks` | Status, delay flag/cause, `est_days`, `assigned_member_id`. Status/delay CHECK constraints. |
| `team_member.py` | `team_members` | Name + role directory; soft-deleted via `is_active`. |
| `document.py` | `documents` | File metadata (bytes on disk); `category IN ('technical','meeting_minutes','business')`. |
| `meeting.py` | `meetings` | Sprint/client minutes on a project. |
| `comment.py` | `comments` | Polymorphic (`entity_type`+`entity_id`) on task or milestone; `author` view relationship. |
| `__init__.py` | — | Imports all models so `Base.metadata.create_all()` sees every table. |

### Schemas — `schemas/` (Pydantic request/response per resource)

`auth.py`, `project.py`, `milestone.py`, `task.py`, `team_member.py`, `document.py`, `meeting.py`, `comment.py`, `analytics.py`, `gantt.py`. Each defines `*Input` / `*Update` / `*Out` shapes; `*Out` models include the computed fields (progress, risk, counts) filled by the serialize service.

### Services — `services/` (pure logic, no framework)

| File | Purpose |
|------|---------|
| `progress.py` | `progress_pct`, `rollup` (done/delayed counts), `project_tasks` flatten. |
| `risk.py` | `task_risk` → `on_track`/`at_risk`/`overdue`/`unknown` from status + schedule; `worst_risk` for roll-ups. |
| `analytics.py` | `summary`, `status_breakdown`, `project_timelines`, `delayed_tasks` — dashboard aggregations. |
| `serialize.py` | ORM → response dicts with computed fields, so every endpoint returns identical shapes. |
| `csv_parser.py` | Parse the project-plan CSV (row classification ported from the original `csv_parser.js`) into a project outline. |

### Routers — `routers/` (one resource per file, all mounted under `/api`)

| File | Endpoints (writes require PM unless noted) |
|------|--------|
| `auth.py` | `POST /auth/login`, `GET /auth/me`. |
| `projects.py` | `GET/POST /projects`, `GET/PUT/DELETE /projects/{id}`. |
| `milestones.py` | `GET/POST /projects/{id}/milestones`, `GET/PUT/DELETE /milestones/{id}`. |
| `tasks.py` | `GET/POST /milestones/{id}/tasks`, `GET/PUT/DELETE /tasks/{id}`. Enforces delay-cause rules. |
| `team_members.py` | `GET/POST /team-members`, `PUT/DELETE /team-members/{id}` (delete = soft). |
| `documents.py` | list/upload/`GET /documents/{id}/download` (any user)/update/delete. Files on disk, 10 MB cap. |
| `meetings.py` | `GET/POST /projects/{id}/meetings`, `GET/PUT/DELETE /meetings/{id}`. |
| `comments.py` | `GET/POST /comments?entity_type=&entity_id=` (PM **and** owner may post), `DELETE /comments/{id}`. |
| `csv_import.py` | `POST /projects/import-csv` — build a project from a CSV; auto-links/creates team members. |
| `analytics.py` | `GET /analytics/summary|status-breakdown|project-timelines|delayed-tasks` (optional `?project_id=`). |
| `gantt.py` | `GET /projects/{id}/gantt` — frappe-gantt-shaped task rows. |

---

## Frontend — `frontend/src/`

### Entry & routing

| File | Purpose |
|------|---------|
| `main.tsx` | Mounts React with QueryClient, Router, and Auth providers; imports global CSS + gantt CSS. |
| `App.tsx` | Route table. `/login` public; everything else behind `RequireAuth` (inside the AppShell). |
| `styles/globals.css` | **Aurora** design tokens (light `:root` + dark `.dark`), base styles, frappe-gantt theming. |
| `vite.config.ts` | Dev server + `/api` proxy to `localhost:8000`; `@` path alias. |

### lib / context / types

| File | Purpose |
|------|---------|
| `lib/apiClient.ts` | Axios instance; attaches bearer token; on 401 clears token → `/login`. `getApiErrorMessage`. |
| `lib/auth.ts` | Token get/set/clear in localStorage. |
| `lib/utils.ts` | `cn()`, date/size formatting, and the single status/risk **label + colour** maps used by badges and charts. |
| `lib/documentFolders.ts` | The three fixed document folders. |
| `context/AuthContext.tsx` | Holds the user; `login`/`logout`; restores session from token; `isPm`. |
| `types/index.ts` | Domain TypeScript types mirroring backend responses. |
| `types/frappe-gantt.d.ts` | Type shim for frappe-gantt. |

### api/ (thin fetch functions) & hooks/ (TanStack Query)

`api/`: `auth`, `projects`, `milestones`, `tasks`, `team`, `documents`, `meetings`, `comments`, `analytics`, `gantt` — one module per resource.
`hooks/`: `useProjects`, `useMilestones`, `useTasks`, `useTeam`, `useDocuments`, `useMeetings`, `useComments`, `useAnalytics` (+ `useGantt`) — queries + mutation objects with cache invalidation.

### components/ui (primitives)

`button`, `card`, `badge`, `dialog`, `input`, `textarea`, `label`, `select`, `tabs`, `progress`, `skeleton`, `spinner`, `empty-state`, `error-state`. Small shadcn-style building blocks (Radix under dialog/tabs/progress/label).

### components/ (features)

| Path | Purpose |
|------|---------|
| `layout/AppShell.tsx` | Header (brand, nav, theme toggle, user, logout) + centered main. |
| `layout/BrandLogo`, `Nav`, `ThemeToggle`, `RequireAuth` | Branding, top nav, dark/light toggle, route guard. |
| `common/StatusBadge`, `RiskBadge`, `CommentThread` | Status/risk pills; comment thread (PM + owner can post). |
| `dashboard/KpiCard` | KPI tile with accent colour. |
| `dashboard/StatusBreakdownChart`, `ProjectProgressChart` | Recharts bar charts (status counts; per-project progress). |
| `dashboard/DelaysTable` | Delayed tasks with a truncated-note "View" dialog. |
| `dashboard/MilestonesTable` | Expandable milestone rows that lazily load their tasks. |
| `gantt/GanttChart` | frappe-gantt wrapper with Day/Week/Month switch. |
| `documents/DocumentRepository`, `FolderSection` | Three folders; upload (PM), download (all), delete (PM). |
| `meetings/MeetingsPanel`, `MeetingFormDialog` | Meeting minutes list + filter + create/edit. |
| `team/TeamFormDialog` | Add/edit a team member. |
| `project/MilestonesTasksBoard` | Editable milestones + tasks board with per-task comments. |
| `forms/ProjectFormDialog`, `MilestoneFormDialog`, `TaskFormDialog`, `DeleteConfirmDialog`, `CsvImportDialog` | Create/edit/delete/import dialogs (replace the old browser `prompt()`s). |

### pages/

| Page | Route | Purpose |
|------|-------|---------|
| `LoginPage` | `/login` | Sign in; shows demo accounts. |
| `DashboardPage` | `/dashboard` | Portfolio KPIs + two charts + delays table. |
| `ProjectsPage` | `/projects` | Card grid; PM: new project / import CSV. |
| `ProjectDetailPage` | `/projects/:id` | Tabs: Overview · Milestones & Tasks · Gantt · Documents · Meetings. |
| `TeamPage` | `/team` | Team directory table. |
| `NotFoundPage` | `*` | 404 inside the shell. |

---

## Roles & access control

| Capability | Owner / admin | Project manager | Employee | Client |
|---|---|---|---|---|
| Projects | Company-wide | Assigned and task-linked projects | Assigned and task-linked projects | Explicitly linked projects and inherited support workspace |
| Delivery management | All projects | Only projects they are the named manager of | Status updates when write access is granted | Read-only client view |
| Project team | Assign managers and members | Replace the roster of each project they lead | No roster management | Hidden |
| Attendance and leave | Company-wide sheet; review employee leave; owner reviews PM/non-owner admin leave; another admin reviews owner leave | Self-confirm attendance; review leave only for employees fully within managed project scope; own requests go to owner | Self-confirm attendance; submit and view own leave | Denied in UI and API |
| Employee profiles | Full directory and private files | Read-only directory; own private profile | Own private profile | Not available |
| Employment records | Manage job role, employment type, and weekly hours | Read-only workforce view | Own profile | Not available |
| Login roles | Owner assigns/removes privileged roles; admins manage ordinary access | No access administration | Change own password | Not available |
| Project leadership | Owner assigns an eligible Administrator or write-enabled PM; may self-assign | Lead only named projects; may lead multiple | Not available | Hidden |
| Client administration | Full | Not available | Not available | Own portal only |
| Notifications | Project activity | Team/task updates for managed projects | Project/task assignments and coverage | Forwarded-report inbox |

Backend enforcement uses project access plus a stricter named-manager check for project-management actions. UI controls mirror the same boundary, but the API remains the source of truth.

## Deletions from the original prototype

The vanilla-JS localStorage app under `web/` was removed. The date-simulator and browser `prompt()`/`confirm()` dialogs are gone (delays are now explicit flags; dialogs are real modals). CSV import and task comments were **kept**.
