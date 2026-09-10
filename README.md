# TrackerX

TrackerX is a full-stack project delivery and operations workspace. It combines
portfolio reporting, milestone-based Kanban and Gantt planning, attendance,
employee access control, and a permission-aware document repository.

## Stack

- **Backend:** FastAPI, SQLAlchemy, SQLite, JWT authentication
- **Frontend:** React 18, TypeScript, Vite, TanStack Query, Recharts, Tailwind
- **Production:** Docker Compose, nginx, persistent application-data volume

## Production deployment

The repository includes a single-server Docker Compose deployment. Docker and
Docker Compose are required on the target server.

```bash
git clone https://github.com/MahmoudQaddoura/projectx.git
cd projectx
cp .env.production.example .env
# Edit .env and replace every placeholder before continuing.
docker compose config
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

The first start creates an administrator only when the database is empty, using
the `INITIAL_ADMIN_*` values in `.env`. That administrator must replace the
temporary password at first sign-in. Remove `INITIAL_ADMIN_PASSWORD` from `.env`
after the account has been created; subsequent starts use the persisted database.

By default TrackerX listens only on `127.0.0.1:8080`. Put a TLS-terminating
reverse proxy (Caddy, Traefik, or nginx with Let's Encrypt) in front of that port.
Do not expose the backend service or plain HTTP directly to the internet.

The named volume `trackerx_app-data` contains both the SQLite database and all
uploaded documents. A separate `trackerx_app-backups` volume receives a verified
portable backup immediately after deployment and every 24 hours. Each ZIP contains
the database, uploads, SHA-256 checksums, and a manifest. Export backups off the
server regularly; neither runtime data nor confidential uploads are committed to Git.

See [docs/GUIDE.md](docs/GUIDE.md) for the full deployment, update, backup, and
verification procedure.

## Local development

Backend (Python 3.10+):

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m app.load_sample_project
$env:TRACKERX_DEMO_PASSWORD = "replace-with-a-unique-local-password"  # Windows PowerShell
# export TRACKERX_DEMO_PASSWORD="replace-with-a-unique-local-password" # Linux/macOS
python -m app.seed_roles
uvicorn app.main:app --reload --port 8000
```

The sample loader and demo-role seed refuse to run when `ENVIRONMENT=production`.

Frontend (Node 20.19+; Node 22 LTS recommended):

```bash
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The Vite development server proxies `/api` to the
backend on port 8000.

### Initial client organizations

To add the approved MODEE, Alawneh Exchange, PSUT, and JAF client profiles to an
existing database, run this once from `backend/`:

```bash
python scripts/seed_main_clients.py
```

The operation is idempotent. It links PSUT to both PSUT LLM Engine and
VerifyX-PSUT. Generated portal accounts remain disabled until an administrator
enters the official contact email, issues a temporary password, and enables the
login from the Clients page.

## Release checks

```bash
cd frontend
npm ci
npm run build

cd ../backend
python scripts/run_tests_safely.py
python -m compileall -q app
```

Always use the safe test runner on a server. It selects a disposable SQLite
database before importing TrackerX and cannot migrate or clear application data.
