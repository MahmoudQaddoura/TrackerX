# Changes Plan 2 — Teams Removal, GitHub Repos, Gantt Fix & Employee Directory

Status: **implemented and verified (2026-07-19).**

This covers five requests from a follow-up session after the initial
CHANGES_PLAN.md work: (1) Gantt chart fix for tasks with no dates,
(2) importing a second project from CSV (JAF), (3) fixing many-to-many
team membership, (4) adding a GitHub repo link per project, and
(5) **removing the Teams feature entirely** and replacing it with a simple
employee directory.

---

## 0. Summary of what changed

| Area | Before (CHANGES_PLAN) | After (CHANGES_2) |
|------|-----------------------|-------------------|
| **Teams** | `Team` model, `project_teams`, `team_member_teams` — teams as organizational units | **Deleted.** No teams at all. Only a flat `team_members` directory. |
| **Team Members** | Had `team_id` FK, many-to-many via join table | `team_id` removed. Members are independent. Linked to users via `user_id`. |
| **Access Control** | Based on team membership & team leadership | Simplified: admin/pm see everything; developer sees projects where they have tasks; client sees their `project_clients` entries. |
| **Project** | No GitHub field | Added `github_repo_url` column. |
| **Gantt** | Required tasks to have dates | Auto-schedules tasks without dates based on `est_days` and `sort_order`. |
| **Nav / Pages** | `/team` → Teams management page | `/employees` → Employee directory page (card list + profile drill-down). |
| **Team-related frontend** | `TeamPage.tsx`, `components/team/`, `api/teams.ts`, `hooks/useTeams.ts` | All deleted. Replaced by `EmployeeListPage.tsx`, `api/team.ts`, `hooks/useTeam.ts`. |
| **Kanban** | Filtered by team membership | Simplified — developer sees all tasks within their accessible projects. |

---

## 1. Gantt chart auto-scheduling

### Problem
All tasks were imported from CSV with null `start_date` / `end_date`.
The Gantt chart rendered empty because it had no dates to plot.

### Fix (`backend/app/routers/gantt.py` — rewritten)
Tasks without dates are now auto-scheduled server-side:
- **Milestones** run sequentially (each starts after the previous one ends).
- **Tasks within a milestone** are stacked by `sort_order`, each lasting
  `est_days` (default 1 if null).
- The **anchor date** is `project.created_at`.
- Auto-generated dates are returned in the API response but **not persisted**
  to the database — so re-importing or re-seeding won't be overwritten.

### Files changed
- `backend/app/routers/gantt.py` — full rewrite of the date-computation logic.

---

## 2. Second project import (JAF)

### Request
Import `data/JAF_Tasks.csv` as a new project (like the existing PSUT one),
assign it to a new team "JAF Development Team" composed of the PSUT team
minus Mohammad Abzakh, Abed Al Qader Madi, and Yehya Mujahed.

### What was done
- Created `backend/app/load_jaf_project.py` — a one-shot import script
  mirroring the existing `load_sample_project.py` pattern.
- Created the "JAF Development Team" with the filtered member set.
- Linked the new project to the new team via `project_teams`.
- **Note:** This script was later deleted when the Teams feature was removed.
  The JAF project and its tasks/milestones/members remain in the database,
  but team assignment was migrated to the many-to-many model, then dropped
  when teams were removed.

---

## 3. Many-to-many team membership (intermediate)

### Problem
Originally each `team_member` had a single `team_id`. The user wanted
members to belong to multiple teams simultaneously.

### Fix (later superseded)
- Created `team_member_teams` join table.
- Updated `TeamMember` model to use `teams = relationship(secondary=...)`.
- Updated schemas and `serialize.py` to return `team_ids` / `team_names` lists.

These changes were later **reverted** when teams were removed entirely.

---

## 4. GitHub repo URL on projects

### Request
Add a button on each project to open its GitHub repository. Different
projects have different repo links, set at project creation time.

### Backend changes
- **`backend/app/models/project.py`**: Added `github_repo_url = Column(Text, nullable=True)`.
- **`backend/app/schemas/project.py`**: Added `github_repo_url` to
  `ProjectInput`, `ProjectUpdate`, and `ProjectOut`.
- **`backend/app/services/serialize.py`**: `project_out()` now includes
  `github_repo_url`.
- **Database migration**: `ALTER TABLE projects ADD COLUMN github_repo_url TEXT`.

### Frontend changes
- **`frontend/src/types/index.ts`**: Added `github_repo_url?: string | null`
  to the `Project` interface.
- **`frontend/src/api/projects.ts`**: Added `github_repo_url` to `ProjectPayload`.
- **`frontend/src/components/forms/ProjectFormDialog.tsx`**: Added a GitHub
  repo URL input field, wired into form state and submit.
- **`frontend/src/pages/ProjectDetailPage.tsx`**: When `github_repo_url` is
  set, an `ExternalLink` icon button appears next to the project name. Clicking
  it opens the repo in a new browser tab.

---

## 5. Teams feature removed → Employee Directory

### Rationale
The user decided teams were unnecessary complexity. Replaced with a flat
employee list: admin manages employees; PM views profiles; developer/client
see nothing.

### 5.1 Backend: models
- **`backend/app/models/team.py`**: Stripped to just the `project_clients`
  join table. Removed `Team` class, `project_teams`, `team_member_teams`.
- **`backend/app/models/team_member.py`**: Removed `team_id` column and
  `teams` relationship. Now only has `tasks` and `user` relationships.
- **`backend/app/models/__init__.py`**: Updated imports — no `Team`, only
  `project_clients`.

### 5.2 Backend: routers
- **`backend/app/routers/teams.py`**: **Deleted.**
- **`backend/app/routers/team_members.py`**: Rewritten:
  - `GET /team-members` — admin: all members; pm: all members (read-only);
    developer/client: returns `[]`.
  - `GET /team-members/{id}` — admin/pm: full profile with projects, task
    counts, workload; developer/client: 403.
  - `POST /team-members` — admin only.
  - `PUT /team-members/{id}` — admin only.
  - `DELETE /team-members/{id}` — admin only (soft-delete, sets `is_active=0`).
- **`backend/app/routers/tasks.py`**: Simplified Kanban filter — removed
  team-based teammate filtering. Developer sees all tasks within their
  accessible projects.
- **`backend/app/main.py`**: Removed `teams` router from imports and mounting.

### 5.3 Backend: access control (`deps.py`)
Simplified — no team-based scoping at all:
- **`get_accessible_project_ids(user, db)`**:
  - `admin` / `pm` → returns `None` (see everything).
  - `developer` → projects where they have at least one assigned task.
  - `client` → projects in `project_clients` table.
- Removed: `get_led_team_ids`, `get_member_team_ids`, and all team-aware helpers.

### 5.4 Backend: schemas & serialization
- **`backend/app/schemas/team.py`**: **Deleted.**
- **`backend/app/schemas/task.py`**: Removed `assigned_team_ids` and
  `assigned_team_names` from `TaskOut`.
- **`backend/app/schemas/team_member.py`**: Rewritten — includes `projects`
  list, `total_tasks`, `done_tasks`, `active_est_days` for workload display.
- **`backend/app/services/serialize.py`**: `team_member_out()` rewritten;
  `task_out()` removed team fields; `team_out()` removed.

### 5.5 Backend: seed script
- **`backend/app/seed_roles.py`**: Rewritten. No team creation. Creates users,
  links to `team_member` records via `user_id`, links client via
  `project_clients`. Idempotent check on admin user. Deleted old
  `seed_roles.py` and `load_jaf_project.py`.

### 5.6 Backend: database migration
SQLite doesn't support `DROP COLUMN`, so tables were recreated:
- Dropped: `teams`, `project_teams`, `team_member_teams`.
- Recreated `team_members` without `team_id`.
- Added `github_repo_url` to `projects`.
- Final tables: `users`, `projects`, `comments`, `project_clients`,
  `milestones`, `meetings`, `documents`, `tasks`, `team_members`.

### 5.7 Frontend: types
- **`frontend/src/types/index.ts`**:
  - Removed `Team` interface entirely.
  - Changed `TeamMember` to include `projects: {id, name}[]`, `total_tasks`,
    `done_tasks`, `active_est_days`.
  - Removed `assigned_team_ids` / `assigned_team_names` from `Task`.

### 5.8 Frontend: pages & components
- **`frontend/src/pages/TeamPage.tsx`**: **Deleted.**
- **`frontend/src/components/team/`**: **Deleted** (4 files).
- **`frontend/src/pages/EmployeeListPage.tsx`**: **New.** Employee directory:
  - Card grid showing name, role, active status.
  - Click a card → profile drill-down dialog showing assigned projects,
    workload (total/done tasks, active est. days), and task list.
  - Admin: "Add" button opens create dialog (name + role). Edit/delete
    buttons on each card.
  - PM: read-only view — can see the list and open profiles.
  - Developer/client: page returns empty state.
- **`frontend/src/App.tsx`**: Route changed from `/team` to `/employees`.
- **`frontend/src/components/layout/Nav.tsx`**: Label changed to "Employees",
  link to `/employees`.

### 5.9 Frontend: API & hooks
- **`frontend/src/api/teams.ts`**: **Deleted.**
- **`frontend/src/hooks/useTeams.ts`**: **Deleted.**
- **`frontend/src/api/team.ts`**: Kept — `fetchTeam`, `createMember`,
  `updateMember`, `deleteMember`.
- **`frontend/src/hooks/useTeam.ts`**: Kept — `useTeam(activeOnly)`,
  `useTeamMutations()`.

### 5.10 Frontend: Kanban simplification
- `KanbanBoard.tsx` no longer filters by team — developers see all cards on
  projects they can access.

---

## 6. Files changed (complete list)

### Backend — deleted
- `backend/app/models/team.py` (Team class, join tables — only project_clients remains)
- `backend/app/routers/teams.py`
- `backend/app/schemas/team.py`
- `backend/app/load_jaf_project.py`

### Backend — modified
- `backend/app/models/__init__.py`
- `backend/app/models/project.py` (added github_repo_url)
- `backend/app/models/team_member.py` (removed team_id)
- `backend/app/deps.py` (simplified access control)
- `backend/app/routers/team_members.py` (rewritten)
- `backend/app/routers/tasks.py` (simplified Kanban filter)
- `backend/app/routers/gantt.py` (auto-scheduling)
- `backend/app/main.py` (removed teams router)
- `backend/app/schemas/project.py` (added github_repo_url)
- `backend/app/schemas/task.py` (removed team fields)
- `backend/app/schemas/team_member.py` (rewritten)
- `backend/app/services/serialize.py` (project_out, task_out, team_member_out)
- `backend/app/seed_roles.py` (rewritten, no teams)
- `backend/data/app.db` (migrated)

### Frontend — deleted
- `frontend/src/pages/TeamPage.tsx`
- `frontend/src/components/team/` (4 files: AddMemberDialog, TeamFormDialog, TeamMemberFormDialog, UserCreateDialog)
- `frontend/src/api/teams.ts`
- `frontend/src/hooks/useTeams.ts`

### Frontend — new
- `frontend/src/pages/EmployeeListPage.tsx`

### Frontend — modified
- `frontend/src/types/index.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/layout/Nav.tsx`
- `frontend/src/pages/ProjectDetailPage.tsx`
- `frontend/src/components/forms/ProjectFormDialog.tsx`
- `frontend/src/api/projects.ts`

### Docker / config — unchanged
- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`,
  `frontend/nginx.conf` — no changes needed.

---

## 7. Verification

- **Backend**: `python3 -c "from app.main import app; print('OK')"` → compiles clean.
- **Frontend**: `npx tsc --noEmit` → zero errors.
- **Database**: 9 tables confirmed correct; `teams`, `project_teams`,
  `team_member_teams` gone; `github_repo_url` present on `projects`;
  `team_id` gone from `team_members`.

---

## 8. Demo logins (password supplied through `TRACKERX_DEMO_PASSWORD`)

| Role | Email |
|------|-------|
| admin | `admin@demo.com` |
| pm | `yazan.abu.osbeh@demo.com` |
| client | `client@demo.com` |
| developer | `mahmoud.qaddoura@demo.com` |
| developer | `mohammad.al.balawi@demo.com` |
| developer | `lina.khalil@demo.com` |
| developer | `abed.al.qader.madi@demo.com` |
| developer | `yehya.mujahid@demo.com` |

---

# Deployment Guide — Private Server (94.176.182.90)

This guide walks through deploying the full application to the blockexe
private server at `94.176.182.90` using Docker Compose. The app will be
served on port 8080 internally; you'll then wire up the existing domain
with a reverse proxy (nginx or Caddy) on the host.

## Prerequisites

- SSH access to `94.176.182.90`:
  - **Username:** `blockexe`
  - **Password:** `blockexe123`
- The server needs **Docker** and **Docker Compose** installed.
- Git (to clone the repo) or `scp` (to copy the project folder).

---

## Step 1: SSH into the server

```bash
ssh blockexe@94.176.182.90
# Enter password: blockexe123
```

Once logged in, check what's already installed:

```bash
docker --version        # should be 24+
docker compose version  # should be 2+
git --version           # for cloning
```

If Docker isn't installed, run:

```bash
# Install Docker (Ubuntu/Debian)
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker blockexe   # so you don't need sudo for docker
# Log out and back in for the group change to take effect
```

---

## Step 2: Transfer the project to the server

**Option A — Git clone** (if the repo is hosted somewhere like GitHub):

```bash
cd ~
git clone <your-repo-url> projectx
cd projectx
```

**Option B — scp the whole folder** from your local machine:

```bash
# Run this FROM YOUR LOCAL MACHINE, not the server:
cd /home/mahmoud/app/blockexe/projectx_codebases
scp -r ./projectx blockexe@94.176.182.90:~/projectx
# Enter password: blockexe123
```

Then SSH back in and verify:

```bash
ssh blockexe@94.176.182.90
ls ~/projectx/
# You should see: docker-compose.yml  backend/  frontend/  CHANGES_PLAN.md  CHANGES_2.md  ...
```

---

## Step 3: Set the JWT secret and start the app

Generate a strong random secret and export it, then build and launch:

```bash
cd ~/projectx

# Generate a secure JWT secret (do this once, save it somewhere safe)
export JWT_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"

# Build and start both containers in the background
docker compose up -d --build
```

Wait 30—60 seconds for the build to complete, then check that both
containers are running:

```bash
docker compose ps
# You should see two services with status "Up":
#   projectx-backend-1   (port 8000, internal only)
#   projectx-frontend-1  (port 8080 → 80)
```

Test that the app is reachable:

```bash
curl -s http://localhost:8080 | head -20
# Should return the index.html of the React app

curl -s http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"<local-temporary-password>"}'
# Should return a JSON with an access_token
```

---

## Step 4: Wire up the domain with a reverse proxy

Since there's already a domain pointing to this server, you need a reverse
proxy on the host that forwards traffic to Docker's port 8080.

### Option A — Nginx (most common)

Install nginx on the host:

```bash
sudo apt install -y nginx
```

Create a site config (replace `your-domain.com` with the actual domain):

```bash
sudo nano /etc/nginx/sites-available/projectx
```

Paste this config:

```nginx
server {
    listen 80;
    server_name your-domain.com;   # ← change this to your actual domain

    # Proxy all traffic to the Docker frontend container on port 8080
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload:

```bash
sudo ln -s /etc/nginx/sites-available/projectx /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default   # remove default if it conflicts
sudo nginx -t                               # test config
sudo systemctl reload nginx
```

### Option B — Caddy (auto-HTTPS, simpler)

If you prefer automatic HTTPS with Let's Encrypt:

```bash
sudo apt install -y caddy
```

Create a Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

```
your-domain.com {
    reverse_proxy 127.0.0.1:8080
}
```

Reload:

```bash
sudo systemctl reload caddy
```

Caddy will automatically obtain and renew an SSL certificate.

---

## Step 5: HTTPS (if using Nginx)

If you chose Nginx and want HTTPS, install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Follow the prompts; Certbot will auto-configure SSL in your nginx config.
```

---

## Step 6: Update CORS origins (if needed)

If you're using a custom domain, update the `CORS_ORIGINS` env var in
`docker-compose.yml` to include it:

```yaml
# In docker-compose.yml, under backend → environment:
CORS_ORIGINS: '["http://localhost:8080","https://your-domain.com"]'
```

Then rebuild:

```bash
docker compose up -d --build
```

---

## Step 7: Verify everything

1. Open `http://your-domain.com` (or `https://your-domain.com` if you set up TLS).
2. You should see the login page.
3. Log in with `admin@demo.com` and the local temporary password you supplied.
4. Verify:
   - Projects page loads with PSUT and JAF projects.
   - Gantt chart renders with auto-scheduled tasks.
   - GitHub repo button works on project detail pages.
   - `/employees` page shows the employee directory.
   - Each role sees the correct tabs and data.

---

## Useful Docker commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart after config changes
docker compose up -d --build

# Stop everything
docker compose down

# Stop and wipe the database volume (fresh start)
docker compose down -v
```

---

## Persistent data note

The SQLite database and uploaded documents are stored in a Docker volume
named `projectx_app-data`. This survives `docker compose down` (without `-v`).
To back it up:

```bash
docker compose exec backend cp -r /app/data /app/data-backup
docker compose cp backend:/app/data-backup ./backup-$(date +%Y%m%d)
```
