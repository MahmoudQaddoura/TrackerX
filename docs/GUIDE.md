# TrackerX deployment guide

This guide deploys TrackerX on one Linux server with Docker Compose. nginx serves
the React application and proxies `/api` to FastAPI over the private Compose
network. Only the nginx port is published.

## 1. Server prerequisites

- A Linux server with Docker Engine and the Docker Compose plugin
- A DNS record for the TrackerX domain
- A TLS reverse proxy such as Caddy, Traefik, or nginx with Let's Encrypt
- A backup destination outside the server

Keep ports 8000 and the database private. The default Compose binding exposes
TrackerX only at `127.0.0.1:8080` for the outer TLS proxy.

## 2. Configure the release

```bash
git clone https://github.com/MahmoudQaddoura/projectx.git
cd projectx
cp .env.production.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Edit `.env` and set:

- `JWT_SECRET_KEY` to the generated value. Keep it stable across restarts.
- `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and `INITIAL_ADMIN_FULL_NAME`.
- `CORS_ORIGINS` to the public HTTPS URL.
- `TRACKERX_BIND_ADDRESS` and `TRACKERX_HTTP_PORT` only if the reverse proxy uses
  a different local endpoint.

The real `.env` is ignored by Git. Never commit it or send it in chat.

## 3. Validate and start

```bash
docker compose config
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend frontend
curl --fail http://127.0.0.1:8080/api/health
```

The health endpoint must return `{"status":"ok"}` and both services must become
healthy. On an empty database, startup creates the first administrator and marks
its password as temporary. Sign in through the HTTPS domain and replace it.

After that first successful sign-in, remove `INITIAL_ADMIN_PASSWORD` from `.env`.
The bootstrap process skips account creation whenever the database already has a
user, so it never resets an existing password.

## 4. TLS reverse proxy

Forward the public HTTPS domain to `127.0.0.1:8080`. Preserve the `Host`,
`X-Forwarded-For`, and `X-Forwarded-Proto` headers. Enable automatic certificate
renewal and redirect HTTP to HTTPS.

The bundled nginx layer permits request bodies up to 55 MB, matching the
backend's 50 MB per-file limit with multipart overhead.

## 5. Back up persistent data

TrackerX stores the SQLite database and uploaded files in `trackerx_app-data`.
The `backup` service snapshots both into one checksum-verified ZIP in the separate
`trackerx_app-backups` volume immediately after startup and every 24 hours.

Create an additional backup before an upgrade:

```bash
docker compose exec backup python -m app.backup --reason pre-upgrade
docker compose exec backup ls -lh /app/backups
mkdir -p ./backups
docker compose cp backup:/app/backups/. ./backups/
```

Verify any exported archive before relying on it:

```bash
docker compose exec backup python -m app.backup --verify /app/backups/ARCHIVE.zip
```

The manifest links every database document record to a stored file and records a
SHA-256 checksum for every entry. Keep at least one exported copy outside the
server. For larger teams or multiple application replicas, migrate to PostgreSQL
and object storage before scaling horizontally.

## 6. Update without losing data

```bash
git fetch origin
git checkout master
git pull --ff-only origin master
docker compose build --pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

Create and export a verified backup first. Do not run `docker compose down -v`;
`-v` deletes both the live-data and on-server backup volumes.

## 7. Rollback

Keep the previous tested Git commit hash. To roll back application code, check
out that commit and rebuild the services. Restore the data backup only if the
release changed stored data incompatibly.

## 8. Operational checks

- `docker compose ps` — service and health status
- `docker compose logs -f backend frontend` — application logs
- `curl --fail https://your-domain/api/health` — public health check
- Verify login, dashboard, assigned projects, Kanban, Gantt, attendance, document
  upload, multi-file upload, preview, and permission enforcement after release
