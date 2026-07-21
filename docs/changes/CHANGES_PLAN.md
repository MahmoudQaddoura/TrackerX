# Changes Plan — Roles, Teams & Kanban Board

Status: **implemented and verified end-to-end (2026-07-14).**

This covers three requests: (1) a 4-tier role/permission system, (2) a
Team → Team Lead → Team Member hierarchy with capacity tracking, (3) a
per-project Kanban board, and how tab visibility splits between the new
Kanban board and the existing Milestones & Tasks view.

---

## 0. Confirmed decisions

1. **Roles.** `owner` is repurposed into **`admin`** (full CRUD, company-
   wide). `pm` stays `pm` but scope narrows to "only projects assigned to a
   team this person leads." New roles: **`developer`** (Kanban-only, drag
   between columns, no field edits) and **`client`** (old `owner` behavior —
   read + comment + download — scoped to only their own project(s)).

2. **Kanban statuses.** 5 columns, keeping the existing name **`todo`**
   (not renamed to "pending"): `todo, in_progress, blocked, in_review, done`.
   `delayed` is dropped as a status/column; it stays as the existing
   `is_delayed`/`delay_cause` overlay flag, shown as a badge on a card in
   whatever column it's in.

3. **Where PM/admin edit milestones & tasks.** The Kanban tab becomes the
   admin/PM's work-management surface: milestone swimlanes with add/edit/
   delete controls, "add task" per swimlane, clicking a card opens the full
   task edit form. Only `client` sees the existing read-only Milestones &
   Tasks tab. Admin/PM/developer never see that tab.

4. **Developer scope** = the whole team's shared board (every teammate's
   cards on projects assigned to that team), not a personal-only filter.

5. **One team per person** for now (plain `team_id` column, not a join
   table). A PM can still lead more than one team.

6. **Real org data for PSUT** (no placeholder/fabricated team — this is the
   real demo project so we use the real people):
   - New **Team** "PSUT LLM Engine Delivery Team", lead = **Yazan Abu
     Osbeh** (existing assignee → gets a `pm` login), assigned to the PSUT
     project.
   - **Developer** logins created for the remaining active assignees:
     Mahmoud Qaddoura, Mohammad Al Balawi, Lina Khalil, Abed Al Qader Madi,
     Yehya Mujahid — all added to the new team.
   - **Mohammad Abzakh** left the company: soft-deactivated
     (`is_active = 0`, no login, not on the team), matching the app's
     existing soft-delete pattern so his historical task assignments (17
     tasks in the CSV) keep their attribution instead of being orphaned.
   - New **admin** user, full name **Mohammad Alnabhan** (replaces the
     `owner@demo.com` demo persona).
   - New **client** login for the PSUT-side stakeholder — no real contact
     name was given in the CSV, so this stays a generic "PSUT Stakeholder"
     placeholder label (consistent with not fabricating a specific person)
     until you rename it.
   - `weekly_capacity_days` is left unset on the new team — no capacity
     number was given, and I won't invent one; the Teams page will show
     "not set" until you configure it.

7. **Capacity metric**: `sum(est_days of that team's non-done tasks) /
   team.weekly_capacity_days`, shown as a load % + badge (On track / Near
   capacity / Overloaded) once capacity is set.

8. **Migration approach**: no Alembic in this backend, just
   `Base.metadata.create_all()`. Since this is still pre-launch demo data,
   the DB is dropped and rebuilt (new column/constraint shapes), then
   repopulated by re-running the CSV loader plus a new role/team seed
   script — not a hand-rolled in-place migration. This stops being fine
   once real client data exists; worth introducing Alembic at that point.

---

## 1. Role & permission matrix

| Capability | admin | pm (team lead) | developer | client |
|---|---|---|---|---|
| See all projects company-wide | ✅ | ❌ (only projects assigned to a team they lead) | ❌ (only projects assigned to their team) | ❌ (only projects they're a client on) |
| Dashboard (cross-project KPIs) | ✅ full | ✅ scoped to their projects | ❌ no nav entry | ❌ no nav entry |
| Project → Overview / Gantt / Documents / Meetings tabs | ✅ | ✅ (own projects) | ❌ | ✅ (own projects, read + comment + download) |
| Project → **Milestones & Tasks** tab | ❌ (uses Kanban instead) | ❌ (uses Kanban instead) | ❌ | ✅ **read-only**, own projects |
| Project → **Kanban** tab | ✅ full | ✅ full, own projects | ✅ own team's projects | ❌ |
| Create/edit/delete milestones | ✅ | ✅ own projects | ❌ | ❌ |
| Create/edit/delete tasks (title, dates, assignee, est., delay info) | ✅ | ✅ own projects | ❌ | ❌ |
| Move a Kanban card between pending/in progress/blocked/in review | ✅ | ✅ | ✅ (own team's cards) | ❌ |
| Move a card **into** `done` | ✅ | ✅ | ❌ (only PM/admin, typically from in review) | ❌ |
| Move a card **out of** `done` | ✅ | ✅ | ❌ | ❌ |
| Comment on tasks/milestones | ✅ | ✅ | ➖ (tbd — not requested; default to no) | ✅ |
| Teams tab: create team, assign lead, function, projects, capacity | ✅ | ❌ | ❌ | ❌ |
| Teams tab: add/remove members within own team | ✅ | ✅ own team(s) | ❌ | ❌ |
| Manage user accounts (create logins) | ✅ | ❌ | ❌ | ❌ |

---

## 2. Data model changes

### 2.1 `users`
- `role` CHECK constraint: `('pm','owner')` → `('admin','pm','developer','client')`.
- No other column changes. JWT already carries `role`, unaffected.

### 2.2 New table `teams`
```
id, name, function (text, e.g. "Backend Engineering"), lead_user_id (FK users.id, nullable),
weekly_capacity_days (float, nullable — admin-set), created_at, updated_at
```
A PM can lead more than one team (plain FK, no uniqueness constraint on `lead_user_id`).

### 2.3 New join table `project_teams`
```
project_id (FK projects.id), team_id (FK teams.id)   -- composite PK
```
Many-to-many: a team can work on several projects; a project can involve
several teams. This is the access-control backbone for `pm`/`developer`
scoping.

### 2.4 New join table `project_clients`
```
project_id (FK projects.id), user_id (FK users.id, role='client')   -- composite PK
```
Access-control backbone for `client` scoping (supports a client user tied to
more than one project, e.g. an agency).

### 2.5 `team_members`
- Add `team_id` (FK teams.id, nullable — unassigned members can still exist,
  matching today's "just a name" assignees from CSV import).
- Add `user_id` (FK users.id, nullable, unique — set only when this member
  also has a login, i.e. role='developer'). Nullable so CSV-imported names
  without a login keep working exactly as they do today.

### 2.6 `tasks`
- `status` CHECK constraint: drop `'delayed'` only, keep `'todo'` as-is.
  → `('todo','in_progress','in_review','blocked','done')`.
- No column changes; `is_delayed`/`delay_cause`/`delay_comment` stay as the
  orthogonal "flagged as delayed" overlay, settable by admin/pm regardless
  of column.
- The old rule "status == 'delayed' implies is_delayed" goes away since
  `'delayed'` is no longer a status.

### 2.7 Cascade/soft-delete notes
- Deleting a `Team` should not delete its members or their task history —
  `team_members.team_id` → `SET NULL` on delete, same pattern as
  `assigned_member_id` today.
- Deleting a `Project` already cascades to milestones/tasks; `project_teams`
  and `project_clients` rows for that project cascade too (`ON DELETE CASCADE`).

---

## 3. Backend changes

### 3.1 Access-control dependencies (`app/deps.py`)
Replace the single `require_pm` with a small set of composable checks:

- `require_admin` — role == 'admin'.
- `require_manager` — role in ('admin','pm') — used for milestone/task
  CRUD endpoints (replaces today's `require_pm`).
- `get_accessible_project_ids(user, db) -> set[int] | None` — returns `None`
  for admin (meaning "no filter"), or the concrete set of project ids the
  user may see, computed as:
  - `pm`: projects joined to any team where `team.lead_user_id == user.id`
  - `developer`: projects joined to the team their `team_members` row
    belongs to
  - `client`: projects in `project_clients` for this user
- `require_project_access(project_id, user, db)` — 404/403 if the resolved
  project isn't in the accessible set. Applied to every project-scoped
  router (`projects`, `milestones`, `tasks`, `gantt`, `documents`,
  `meetings`, `comments`, `analytics`, and the new `kanban`/`teams` routers).

### 3.2 Scoped list endpoints
`GET /projects`, `GET /analytics/*` (dashboard) filter by
`get_accessible_project_ids` instead of returning everything.

### 3.3 Task status-change rules (`routers/tasks.py`)
`_normalize_and_validate` currently only checks the value is a legal status.
Add a role-aware transition check, used by both the existing `PUT
/tasks/{id}` (full edit, admin/pm) and a new lightweight endpoint:

- `PATCH /tasks/{id}/status` — body `{status}` only. Open to
  developer/pm/admin (with `require_project_access`).
  - developer: reject if `status == 'done'` or current status == 'done'
    (can't move into or out of done). Reject if the request body has any
    field other than `status`.
  - pm/admin: no restriction.
- Existing `PUT /tasks/{id}` stays admin/pm-only (`require_manager`) for
  full field edits.

### 3.4 New endpoint: flattened project tasks (for the Kanban board)
`GET /projects/{project_id}/tasks` → `list[TaskOut]`, all tasks across all
milestones (mirrors the existing `gantt.py` traversal pattern), extended
with `assigned_team_id` / `assigned_team_name` so cards can show "Sofia
Alvarez · Frontend Team". For a `developer`, the router filters this list
server-side to tasks whose assignee is unassigned or on the caller's team
(even if the project involves multiple teams, a dev only sees their team's
cards).

### 3.5 New router `routers/teams.py`
```
GET    /teams                    admin: all; pm: only teams they lead
POST   /teams                    admin only — name, function, lead_user_id, weekly_capacity_days, project_ids[]
GET    /teams/{id}               admin, or the team's own lead
PUT    /teams/{id}                admin only for name/function/lead/capacity/projects;
                                  pm (own team) may only update its member roster (separate endpoint below)
DELETE /teams/{id}                admin only
POST   /teams/{id}/members        admin or the team's lead — attach an existing team_member (or create one)
DELETE /teams/{id}/members/{mid}  admin or the team's lead — detach (sets team_id NULL, does not delete the member)
GET    /teams/{id}/capacity       total tasks, total est. days outstanding, load % — used by the Teams tab
```

### 3.6 User account management
Need *some* way to create `developer`/`client`/`pm` logins (today there's no
"create user" endpoint at all — the two demo users are seeded directly).
Proposing `POST /users` (admin-only) — email, full name, role, password
(or a "send invite" flow if you'd rather not handle passwords directly;
flagging as a decision — simplest for a demo is admin sets an initial
password directly). Team-member linkage to a login happens via
`POST /teams/{id}/members` accepting either an existing `team_member_id`
or a `user_id` to link.

### 3.7 Files touched
`models/user.py`, new `models/team.py`, `models/team_member.py` (add
columns), `models/task.py` (enum), `models/__init__.py`, `deps.py`,
`schemas/*` (new team schemas, updated task schema), `routers/teams.py`
(new), `routers/tasks.py`, `routers/projects.py`, `routers/milestones.py`,
`routers/team_members.py`, `routers/meetings.py`, `routers/comments.py`,
`routers/documents.py`, `routers/analytics.py`, `routers/gantt.py`,
`services/serialize.py`, `services/progress.py`, `services/risk.py`
(status-keyed dicts), `app/seed.py` / a new migration script.

---

## 4. Frontend changes

### 4.1 Nav (`components/layout/Nav.tsx`) — per role
- **admin**: Dashboard, Projects, Team
- **pm**: Dashboard (scoped), Projects (scoped), Team
- **developer**: Projects only (scoped to their team's projects) — no
  Dashboard, no Team link
- **client**: Projects only (scoped to their project(s)) — no Dashboard, no
  Team link

### 4.2 `AuthContext` — replace the single `isPm` boolean with role helpers:
`isAdmin`, `isPm`, `isDeveloper`, `isClient`, plus a combined `canManage =
isAdmin || isPm` used everywhere the old `isPm` gate is today.

### 4.3 `ProjectDetailPage.tsx` tabs — conditional per role
```
Overview     — admin, pm, client
Kanban       — admin, pm, developer          (NEW)
Milestones & Tasks — client only, read-only  (existing component, unchanged behavior)
Gantt        — admin, pm, client
Documents    — admin, pm, client
Meetings     — admin, pm, client
```

### 4.4 New component `components/project/KanbanBoard.tsx`
- Fetches `GET /projects/{id}/tasks` (new endpoint) + `useMilestones` for
  swimlane titles.
- Layout: one swimlane per milestone (collapsible), 5 status columns inside
  each (Pending / In Progress / Blocked / In Review / Done).
- Card shows: title, assignee name + **team name**, est. days, risk badge,
  delay badge if flagged, milestone chip.
- Drag & drop via native HTML5 DnD (no new dependency) — `onDrop` calls
  `PATCH /tasks/{id}/status`. Client-side also enforces the developer
  done-column restriction so the drag visually snaps back instead of firing
  a doomed request.
- Card click: admin/pm → opens the existing `TaskFormDialog` (full edit).
  developer → opens a read-only detail panel + (if we keep comments for
  devs) `CommentThread`.
- Admin/pm-only controls in each swimlane header: add task, edit/delete
  milestone (reuses `MilestoneFormDialog`), "add milestone" button above
  all swimlanes.

### 4.5 `TeamPage.tsx` → redesigned as a Team hierarchy view
- Top level: list of teams (card per team) showing name, function, lead,
  assigned projects, total tasks, capacity bar (load % with
  on-track/near-capacity/overloaded coloring, reusing the `RiskBadge` color
  pattern).
- Expand a team → its members (existing per-member row: name, role, task
  count, active toggle), plus which are dev logins vs. name-only assignees.
- Admin-only: "New team" dialog (name, function, lead picker from pm users,
  capacity, project multi-select).
- Admin + that team's lead: "Add member" / "Remove member" on the expanded
  team.
- pm visiting this page sees only the team(s) they lead (backend already
  filters `GET /teams`).

### 4.6 `ProjectsPage.tsx`, `DashboardPage.tsx`
No structural change — they already just render whatever the API returns;
since `GET /projects` and analytics endpoints will now be scoped
server-side per role, these pages automatically show the right subset.

### 4.7 Files touched
`context/AuthContext.tsx`, `components/layout/Nav.tsx`,
`pages/ProjectDetailPage.tsx`, `pages/TeamPage.tsx` (rewrite), new
`components/project/KanbanBoard.tsx`, new `components/team/TeamFormDialog.tsx`
updates + new `TeamCard`/`TeamMembersPanel`, `api/teams.ts` (new),
`hooks/useTeams.ts` (new), `api/tasks.ts` (add `fetchProjectTasks`,
`updateTaskStatus`), `hooks/useTasks.ts`, `types/index.ts` (Team,
TaskStatus enum change, assigned_team_name on Task), `lib/utils.ts`
(status labels/colors updated for the 5-status set).

---

## 5. Migration / reseed plan for current demo data

1. Drop and recreate `users`, `tasks`, `team_members` (shape changed);
   `projects`, `milestones` untouched; new `teams`, `project_teams`,
   `project_clients` tables created by `create_all`.
2. Re-run the existing CSV loader (`app.load_sample_project`) — no changes
   needed there, it already only sets fields present in the CSV.
3. New `app/seed_roles.py` creates:
   - `admin@demo.com` — role `admin`, full name **Mohammad Alnabhan**
     (replaces `owner@demo.com`)
   - `pm@demo.com` — role `pm`, full name **Yazan Abu Osbeh**, made lead of
     the new team
   - `client@demo.com` — role `client`, full name "PSUT Stakeholder"
     (placeholder pending a real contact name), linked to the PSUT project
     via `project_clients`
   - developer logins for Mahmoud Qaddoura, Mohammad Al Balawi, Lina
     Khalil, Abed Al Qader Madi, Yehya Mujahid — role `developer`
   - all six (`pm` lead + 5 developers) get their existing `team_members`
     row linked via `user_id`, and `team_id` set to the new team
   - Mohammad Abzakh's `team_members` row: `is_active = 0`, `user_id`/
     `team_id` left `NULL` — he keeps his historical task attribution but
     has no login and isn't on the roster
   - all new accounts share the existing demo password (`ChangeMe123!`)
4. Team **"PSUT LLM Engine Delivery Team"** is created and linked to the
   PSUT project via `project_teams`; `weekly_capacity_days` left unset.

---

## 6. Suggested build order

1. Schema + migration script (section 2 & 5) — nothing user-facing yet.
2. Backend RBAC plumbing (`deps.py`, scoped list endpoints) — verify with
   curl/Postman against each of the 4 roles before touching the frontend.
3. Teams router + Teams tab UI (self-contained, low risk).
4. Task status enum rename + `/tasks/{id}/status` endpoint.
5. Kanban board component + wiring into `ProjectDetailPage`.
6. Tab-visibility pass (Milestones & Tasks → client-only; Nav per role).
7. Re-seed demo data, log in as each of the 4 roles, click through end to
   end.

---

Once you've confirmed section 0's assumptions (or corrected them), I'll
start on section 6's build order.
