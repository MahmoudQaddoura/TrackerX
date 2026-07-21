# Guide — Run, Containerize, and Deploy

Three ways to run the Project Task Tracker: **locally for development**, **with Docker** (one command), and **in production**. Demo logins (from the seed): **`pm@demo.com`** (full edit) and **`owner@demo.com`** (read-only + comments + downloads), password **`ChangeMe123!`**.

---

## 1. Run locally (development)

You need **Python 3.10+** and **Node 18+** (this project was verified on Python 3.10 and Node 20).

### Backend (terminal 1)

```bash
cd Prototype/backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed                   # create + seed the SQLite database (once)
uvicorn app.main:app --reload --port 8000
```

- API: `http://localhost:8000/api`
- Interactive docs: `http://localhost:8000/api/docs`
- Health: `http://localhost:8000/api/health`

### Frontend (terminal 2)

> **Node 18+ is required.** Vite 5 will not run on older Node (e.g. Node 12/14/16):
> `npm run dev` crashes with `SyntaxError: Unexpected reserved word` and **no server
> starts**, so the browser shows *"site can't be reached."* Check with `node --version`.
> This machine's default `node` is old, so switch first with `nvm`:

```bash
# In THIS terminal, before anything else:
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm use            # reads frontend/.nvmrc -> Node 20  (or: nvm use 20)

cd Prototype/frontend
node --version                       # must print v18+ (v20.x expected)
npm install
npm run dev                          # http://localhost:5173
```

Wait for the banner `VITE vX.Y ready … ➜ Local: http://localhost:5173/`, then open
**`http://localhost:5173`** and sign in. The dev server proxies `/api` →
`http://localhost:8000`, so the backend (terminal 1) must also be running.
`npm run build` type-checks and produces a production bundle in `dist/`.

---

## 2. Containerize (Docker)

Requires Docker + Docker Compose. From `Prototype/`:

```bash
# Recommended: set a real secret first
export JWT_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"

docker compose up --build
```

Then open **`http://localhost:8080`**.

What compose builds:
- **backend** — the FastAPI image; seeds on first boot, serves on internal port 8000. Its data (SQLite DB + uploaded files) is persisted in the named volume **`app-data`**, so it survives restarts.
- **frontend** — builds the SPA and serves it with **nginx**, which also reverse-proxies `/api` to the backend. The browser only needs port **8080**.

Useful commands:
```bash
docker compose up -d --build     # run detached
docker compose logs -f backend   # follow backend logs
docker compose down              # stop (keep data volume)
docker compose down -v           # stop and DELETE the data volume
```

---

## 3. Deploy to production

The compose stack is deployable as-is on any Docker host (VM, VPS, cloud instance). Checklist:

### 3.1 Configuration & secrets
- **Set a strong `JWT_SECRET_KEY`** (env var or a `.env` next to `docker-compose.yml`). Never ship the default.
- Set `ENVIRONMENT=production`.
- Set `CORS_ORIGINS` to your real domain(s), e.g. `["https://tracker.example.com"]`. In the bundled setup nginx serves the SPA and proxies `/api` on the same origin, so CORS is effectively a non-issue — but keep it tight.

### 3.2 Expose it safely
- Put a TLS-terminating reverse proxy in front (Caddy, Traefik, or nginx + Let's Encrypt) and forward `443 → frontend:80`. Don't serve plain HTTP in production.
- Only the frontend port needs to be public; the backend stays on the internal compose network.
- The nginx config already allows 12 MB request bodies to accommodate the 10 MB upload limit.

### 3.3 Data & backups
- The `app-data` volume holds **both** the SQLite database and all uploaded documents. Back it up regularly:
  ```bash
  docker run --rm -v prototype_app-data:/data -v "$PWD":/backup alpine \
    tar czf /backup/app-data-$(date +%F).tar.gz -C /data .
  ```
- For higher concurrency, switch to PostgreSQL: set `DATABASE_URL=postgresql+psycopg://user:pass@db:5432/tracker`, add a `db` service to compose, and add `psycopg[binary]` to `backend/requirements.txt`. The models are unchanged.

### 3.4 First run
1. `docker compose up -d --build` — the backend seeds demo data on an empty DB.
2. Log in as `pm@demo.com`, **create your own PM account path** by changing seeded users (or edit `seed.py` before first boot), and change/remove the demo accounts.
3. Verify `https://your-domain/api/health` returns `{"status":"ok"}`.

### 3.5 Updating
```bash
git pull
docker compose up -d --build      # rebuilds images; the data volume is preserved
```
Schema changes are applied automatically by `create_all` for **new** tables/columns on SQLite. For destructive schema changes, migrate the data manually or adopt a migration tool.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Frontend loads but API calls 404/500 | Is the backend up? Check `docker compose logs backend` or that uvicorn is running on 8000. |
| 401 right after login | `JWT_SECRET_KEY` changed between requests (e.g. not fixed in prod) — set it once and keep it stable. |
| `sass-embedded not found` on build | Run `npm install` (dev deps include `sass`). |
| Browser says **"site can't be reached"** on `localhost:5173` | The dev server never started. Almost always Node too old — run `node --version`; if under 18, `nvm use 20` and re-run `npm run dev`. Also confirm you opened `5173` (local dev), not `8080` (Docker). |
| `SyntaxError: Unexpected reserved word` on `npm run dev` | Node too old for Vite 5 — `nvm use 20`. |
| Vite fails to start | Node too old — use Node 18+ (`nvm use 20`). |
| Uploads rejected | File over the 10 MB limit, or your outer proxy caps body size — raise `client_max_body_size`. |
