# TrackerX production reliability audit — 10 September 2026

## Executive outcome

TrackerX now has layered process recovery, application-readiness validation, database-integrity checks, verified scheduled backups, safe test isolation, and traceable API failures. These controls materially reduce downtime and recurrence risk. No single-server application can promise literal 100% availability; host, network, DNS, and datacenter failures remain outside the process boundary.

## Production baseline reviewed

- Caddy terminates TLS and renews certificates automatically.
- FastAPI listens only on `127.0.0.1:8000` and systemd restarts the process after failure.
- MinIO document storage runs as a separate automatically restarted service.
- The server has approximately 10 GiB available memory and 186 GiB free disk space.
- The public health URL and database were healthy at the audit baseline.

## Remediations implemented

### Health and recovery

- `/api/health/live` reports process liveness.
- `/api/health` now validates connectivity, all required application tables, at least one production user, SQLite `PRAGMA quick_check`, and document-storage availability.
- Production startup refuses an empty or structurally incomplete core database and directs the operator to restore a verified backup.
- A one-minute systemd readiness timer triggers a controlled backend restart when the application becomes unhealthy.
- API responses carry `X-Request-ID`; unexpected failures return a stable reference identifier, while database operational failures return HTTP 503 with `Retry-After`.

### Database and backups

- SQLite connections enable foreign-key enforcement, WAL journaling, a 30-second busy timeout, normal synchronous durability, and connection pre-ping.
- A persistent daily systemd timer creates a portable checksum-verified database-and-document backup and retains the newest 14 archives.
- Startup backups remain enabled as an additional deployment boundary.

### Release safety

- Backend tests now run through `scripts/run_tests_safely.py`, which chooses a disposable database before importing application modules.
- The destructive leave-coverage test owns a dedicated engine and cannot reach the shared application engine.
- CI retains compilation, Ruff, Python dependency audit, frontend type/build verification, and npm audit gates.
- API contract regression coverage checks every registered method/path and directly exercises milestone and meeting management workflows.

## Residual risks and next scaling threshold

- This is one server, one FastAPI process, and one SQLite database. A full host or datacenter outage still causes downtime.
- Keep at least one encrypted backup copy outside this server. An external destination has not been configured because no storage account or retention policy was supplied.
- Before adding multiple API replicas, migrate the database to managed PostgreSQL and move login throttling to Redis.
- External uptime monitoring should remain independent of the server so it can detect DNS, TLS, routing, and host failures that an internal timer cannot see.
