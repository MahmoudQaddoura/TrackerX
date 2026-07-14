# Project Task Tracker

A full-stack project management tool. Track projects → milestones → tasks with
schedules, delays, and risk; manage a team directory; upload/download project
documents; record sprint meeting minutes; and see it all on dashboards with
charts and a Gantt timeline. Two roles: **PM** (full edit) and **Owner**
(read-only, can download documents and leave comments).

## Stack

- **Backend:** FastAPI · SQLAlchemy · SQLite · JWT auth (`backend/`)
- **Frontend:** React 18 · TypeScript · Vite · TanStack Query · Recharts · frappe-gantt · Tailwind (`frontend/`)
- **Design:** the "Aurora" system — dark + light themes, one status/risk colour source shared by badges and charts.

## Quick start (Docker)

```bash
cd Prototype
export JWT_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
docker compose up --build      # open http://localhost:8080
```

## Quick start (local dev)

```bash
# Backend  (Python 3.10+)
cd Prototype/backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python -m app.seed
uvicorn app.main:app --reload --port 8000

# Frontend (Node 18+ REQUIRED — Vite 5 won't run on older Node; separate terminal)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20   # if default node is old
cd Prototype/frontend && npm install && npm run dev   # open http://localhost:5173
```

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| PM (full edit) | `pm@demo.com` | `ChangeMe123!` |
| Owner (read-only + comments + downloads) | `owner@demo.com` | `ChangeMe123!` |

## Features

- Projects, milestones, and tasks with dates, status, delay tracking, and computed risk
- Portfolio + per-project **dashboards**: KPI cards, status-breakdown and progress charts, delayed-tasks table
- **Gantt** timeline per project (Day/Week/Month)
- **Document repository** per project (three folders); PM uploads, everyone downloads (files download, never render in-browser)
- **Team** directory (names + roles), assignable to tasks
- **Meetings** — sprint/client minutes recorded by the PM
- **Comments** on tasks/milestones (PM and Owner)
- **CSV import** — build a whole project from the original project-plan CSV format
- Login/JWT auth, role-based access, dark/light theme

## CSV import format

Seven columns (header row required):

```csv
#,Task,Description,Est. Acc Days,Assignee,Internal Delays,Client Delays
```

Rows are auto-classified: a name with an empty Task column is the **project title**;
`Milestone …` starts a **milestone**; `1.1`, `2.14`, … are **tasks**; `Estimated Effort …`
summary rows are ignored. Assignees become team members automatically.
`scripts/xlsx_to_csv.py` converts the bundled Excel plan into this CSV.

## Documentation

- **[codebase_documentation.md](codebase_documentation.md)** — every file and its purpose
- **[database_documentation.md](database_documentation.md)** — schema, relationships, connection lifecycle
- **[GUIDE.md](GUIDE.md)** — run locally, containerize, and deploy to production
