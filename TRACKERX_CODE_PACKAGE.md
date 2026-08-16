# TrackerX Code Package

This repository contains the complete TrackerX application source as of **16 August 2026**.

GitHub source: <https://github.com/MahmoudQaddoura/projectx>
Update base: `ceeb478fb9e30502f87cb6841656f8d0c86a3da3`

## Included

- `backend/` — FastAPI API, SQLAlchemy models, schemas, routers, authentication, attendance, documents, Kanban, and Gantt services.
- `frontend/` — React, TypeScript, Vite, TanStack Query, Tailwind, document control, Kanban, attendance, and milestone-first Gantt interface.
- `scripts/` — supporting conversion and maintenance scripts.
- `docs/` and `changes/` — project documentation and change notes.
- `data/` — sample import data only.
- Root Docker, package, and README files.

## Deliberately excluded

The repository deliberately excludes runtime or private material:

- Python virtual environments and `node_modules`
- frontend production builds
- SQLite databases and uploaded project documents
- `.env` files, local overrides, logs, and cache files
- Python bytecode and Git metadata

## Main capabilities

- Two document collections with categorized tabs, bulk uploads, original filenames, and milestone tags
- Multi-assignee Kanban tasks with Project Delivery and Maintenance & Operations workstreams
- Admin-controlled employee credentials with read-only/read-write permissions
- Daily attendance sheet with check-in, check-out, status, notes, and bulk save
- Milestone-first Gantt chart linked directly to the corresponding Kanban milestone
- Professional manager and employee dashboards with automatic delayed-task alerts
- Assignment-scoped employee access to project tasks, Gantt, documents, and meetings
- Mandatory temporary-password replacement and password visibility controls
- Secure in-app previews for PDF, images, text/code, JSON, Markdown, and modern Office files
- Assignment-scoped document uploads governed by admin-granted read/write permissions

## Run locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.seed_roles
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

In another terminal:

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open <http://127.0.0.1:5173>.

## Validation completed before packaging

- Backend Python compilation passed.
- Frontend TypeScript and production build passed.
- Assignment, read-only/read-write, password-change, and file-preview API checks passed.
- Runtime databases, uploads, dependency folders, caches, and logs were excluded from Git.
