# TrackerX Security and Reliability Remediation Audit

**Audit date:** 10 September 2026  
**System:** TrackerX production at `trackerx.defendexe.com`  
**Release branch:** `feat/production-reliability`  
**Audit type:** Code, API, database, dependency, host, and availability review with remediation

## Executive verdict

TrackerX is ready for a controlled single-server production deployment. All confirmed critical and high-risk findings discovered during this audit were remediated and re-tested. The production database passed integrity and foreign-key checks, exposed demo credentials were rotated, sensitive files were restricted to the service account, public application ports were minimized, and the application now has layered readiness, recovery, and backup controls.

The result is not a claim of absolute availability or independent certification. TrackerX still runs on one host with one SQLite database, so a host, datacenter, DNS, or upstream network outage can interrupt service. The remaining risks are documented with concrete next actions.

## Scope and method

The audit covered:

- 11,447 lines of backend Python application code.
- 81 OpenAPI paths and 112 registered API operations.
- Authentication, password policy, sessions, authorization, CORS, CSRF controls, request validation, file handling, document previews, exports, and error behavior.
- SQLAlchemy query construction and all raw SQL call sites for injection paths.
- SQLite integrity, schema completeness, foreign keys, account constraints, duplicate identities, compromised passwords, file permissions, and backup recovery.
- Python and JavaScript dependency advisories.
- Production TLS, browser security headers, exposed listening ports, SSH, firewall rules, systemd isolation, service recovery, and scheduled backups.
- Frontend production build size and route-level code splitting.

The previously supplied AI Tutor audit reports were used only as a checklist structure. They describe another product. LLM, RAG, prompt-injection, and vector-store findings are not applicable to TrackerX because those components are not present.

## Findings and remediation status

| ID | Initial risk | Finding | Remediation and evidence | Status |
|---|---:|---|---|---|
| TX-26-01 | Critical | Seven production accounts still matched the shared demo password. | A verified backup was created, every affected account received a unique random temporary password, `auth_version` was incremented to revoke sessions, and password change is required. Re-audit: 0 compromised accounts. | Closed |
| TX-26-02 | High | SSH allowed password authentication and direct root login. | Installed key-only SSH policy, disabled root/password/interactive login, reduced `MaxAuthTries` to 3, validated with `sshd -t`, reloaded SSH, and proved a fresh key session. | Closed |
| TX-26-03 | High | Database and backup paths were readable or writable beyond the service account (`777`, `664`, `775`). | Database and backup directories are now `700`; database, environment, archives, and rotation file are `600`. | Closed |
| TX-26-04 | High | The destructive sample-project loader and demo seed could be invoked under production configuration. | Both commands now fail closed in production. The built-in demo password was removed and local demo setup requires an explicit policy-compliant environment value. | Closed |
| TX-26-05 | Medium | Office document previews parsed uploaded XML with the standard parser. | Replaced it with `defusedxml`, blocking DTD/entity expansion. Added a malicious-entity regression test. | Closed |
| TX-26-06 | High | The prior health endpoint only proved `SELECT 1`; an incomplete or wrong database could appear healthy. | Readiness now checks all required tables, at least one production user, SQLite `quick_check`, and object storage. Production refuses an unexpected empty/core-incomplete database before migration. | Closed |
| TX-26-07 | Medium | Startup-only backups left a scheduling gap. | Added a persistent daily systemd backup timer with checksum verification and retention of the newest 14 archives. An immediate scheduled backup completed successfully. | Closed |
| TX-26-08 | Medium | An unhealthy application had process restart protection but no application-level recovery loop. | Added a one-minute readiness timer and controlled recovery unit. The probe retries during startup to avoid false recovery restarts. | Closed |
| TX-26-09 | Medium | SQLite concurrency and relationship enforcement used defaults. | Enabled WAL, foreign keys, a 30-second busy timeout, normal synchronous durability, connection pre-ping, and `PRAGMA optimize`. | Closed |
| TX-26-10 | Medium | Unexpected failures lacked a stable support reference and database outages appeared as generic 500 responses. | Every request receives `X-Request-ID`. Database operational failures return 503 plus `Retry-After`; unexpected failures return a stable request ID and server-side traceback. | Closed |
| TX-26-11 | High | Test discovery could import the application before selecting a test database, creating a path to production-data damage. | Added a safe test runner that configures disposable database, document, and backup paths before imports and disposes all handles after the suite. CI uses only this runner. | Closed |
| TX-26-12 | Medium | The initial frontend bundle was 759 KB and delayed first-page parsing. | Added route-level lazy loading. The main JavaScript bundle is now 270.12 KB (90.03 KB gzip); the largest page chunk is 219.10 KB. | Closed |
| TX-26-13 | Medium | The host firewall was inactive. | Enabled deny-by-default inbound filtering and allowed only TCP 22, 80, and 443. Backend, PostgreSQL, MinIO, and other application services remain loopback-only. | Closed |
| TX-26-14 | Medium | The initial health timer could run before Uvicorn bound its port and trigger a redundant restart. | Added bounded connection retries and proved the sequence across a controlled restart. Probe result is now `success`. | Closed |

## Application and API security assessment

### Authentication and sessions

- Passwords use bcrypt and a shared 12-to-72-byte policy requiring at least three character classes.
- Common passwords, repeated-character sequences, and identity-derived values are rejected.
- Authentication uses Secure, HttpOnly, SameSite=Strict cookies in production.
- JWTs validate signature, algorithm, issuer, audience, expiry, issued-at time, subject, token ID, and account authorization version.
- Security-sensitive password, role, and access changes revoke previous sessions through `auth_version`.
- Login responses do not reveal whether an email exists and return `429` plus `Retry-After` after throttling.
- Cookie-authenticated writes require the TrackerX request-verification header.

### Authorization

- Owner/admin management, project-manager project scope, employee membership, and client disclosure boundaries are enforced in shared dependencies.
- Clients receive only linked projects and reports explicitly forwarded to them.
- Employee CV/profile files remain private to the employee and administrators; project management alone does not grant access.
- Project-manager task assignment is limited to the managed project roster.
- Leave approval routes employees to PM/admin and routes PM/admin requests to the owner.
- Regression coverage verifies multi-project managers, privileged-account protection, client isolation, attendance scope, report forwarding, and file ownership.

### Injection, input, and file handling

- User-controlled database values use SQLAlchemy expressions or bound parameters.
- Remaining `exec_driver_sql` and SQLite statements are fixed schema migrations, static maintenance SQL, or parameterized values; no user-controlled SQL identifier or fragment was found.
- File storage keys reject absolute paths, traversal components, empty segments, and backslashes.
- Uploads enforce byte, count, filename, extension, and empty-file limits, with database/object-store rollback on failure.
- Office preview archives cap total unpacked size at 30 MB and now reject dangerous XML entities and DTDs.
- HTML, SVG, environment, source, and other risky text-like files are previewed as plain text rather than active browser content.
- Project repository links accept only allowed HTTPS GitHub hosts.

### Browser and transport controls

- TLS is terminated by Caddy with automatic renewal and HTTP-to-HTTPS handling.
- Production API documentation and OpenAPI endpoints are disabled (`404`).
- HSTS, CSP, anti-framing, nosniff, referrer, permissions, COOP, CORP, and no-store API headers are active.
- CORS allows only `https://trackerx.defendexe.com`; trusted hosts are explicit.
- Backend and storage ports bind to loopback; only SSH, HTTP, and HTTPS are publicly reachable.

## Database security and integrity

| Control | Verified result |
|---|---|
| Environment | `production` |
| SQLite quick check | `ok` |
| Foreign-key violations | 0 |
| Tables present | 26 total; all required application tables present |
| User accounts | 14 total; 10 enabled |
| Primary enabled owner/admin | Exactly 1 |
| Duplicate case-insensitive emails | 0 |
| Invalid role/access/enabled states | 0 |
| Accounts matching compromised demo password | 0 after rotation |
| Database directory/file permissions | `700` / `600` |
| Environment file permissions | `600` |
| Backup directory/archive permissions | `700` / `600` |
| Journal and lock handling | WAL plus 30-second busy timeout |
| Relationship enforcement | Foreign keys enabled per connection |

The production audit utility opens SQLite in read-only mode, reports counts rather than hashes or credentials, and exits non-zero when integrity, account, secret-length, compromised-password, or permission checks fail.

## Availability and operations

- `trackerx-backend`, Caddy, and MinIO are active with zero unexpected restarts at final verification.
- The backend listens on `127.0.0.1:8000`; MinIO listens on loopback ports 9000/9001.
- `/api/health/live` provides process liveness.
- `/api/health` reports `status`, `database`, `schema`, `integrity`, and `storage`, and returned HTTP 200 in 0.039 seconds during final verification.
- The one-minute health timer is active and invokes a recovery restart only after bounded retries fail.
- The daily backup timer is active and persistent; the next run is scheduled even across a reboot.
- Startup and scheduled backups use SQLite online backup, full integrity verification, SHA-256 entry checksums, and document manifest coverage.
- The final service sandbox permits no Linux capabilities, restricts devices/namespaces/process visibility/address families, makes the operating system and home tree read-only, and only grants writes to TrackerX data/backups.
- `systemd-analyze security` improved from `7.6 EXPOSED` to `2.8 OK` without breaking health, storage, or backup behavior.
- Server headroom at audit time: approximately 10 GiB available memory and 186 GiB free disk (4% used).

## Verification record

| Gate | Result |
|---|---|
| Backend unit, authorization, export, and security suite | 50/50 passed |
| API unauthenticated failure sweep | 112 operations; no 500 responses |
| OpenAPI route uniqueness | 112 unique method/path operations |
| Ruff correctness scan | Passed |
| Bandit static application scan | 11,447 lines; 0 low, medium, or high findings |
| Python dependency audit | No known vulnerabilities |
| npm dependency audit | 0 vulnerabilities |
| Python compilation | Passed |
| TypeScript validation and Vite production build | Passed |
| Public health | HTTP 200, complete readiness payload |
| Public security headers | HSTS, CSP, framing, nosniff, request ID, no-store verified |
| Production OpenAPI endpoint | HTTP 404 |
| Immediate scheduled backup | Completed and checksum/integrity verified |
| Controlled restart and readiness retry | Passed |
| Fresh SSH key session after hardening | Passed |

## Residual risks and required next controls

These are not unresolved implementation defects in this release; they are architecture or external-service limits.

1. **Single-host availability:** Caddy, API, SQLite, and MinIO share one host. Migrate to managed PostgreSQL, replicated object storage, and at least two application instances before requiring high availability across host failure.
2. **Off-server recovery:** On-server backups are verified but do not protect against total host loss. Configure an encrypted off-site copy with restore drills and an agreed recovery point objective.
3. **External monitoring:** The internal timer cannot detect total host, DNS, routing, or datacenter loss. Use an independent HTTPS monitor and notification channel.
4. **Multi-factor authentication:** MFA is not implemented. Add WebAuthn or TOTP for owner/admin and project-manager accounts before a high-assurance rollout.
5. **Malware inspection:** Uploads are constrained and safely previewed but are not quarantined/scanned by an antivirus service. Add scanning if uploads will be accepted from broadly untrusted external users.
6. **Horizontal scaling threshold:** Login throttling is process-local and SQLite is single-host. Move the throttle state to Redis and persistence to PostgreSQL before running multiple API replicas.
7. **Central security telemetry:** Request IDs and system logs exist, but centralized log retention, anomaly alerts, and incident paging require an external operations platform.

## Recovery and credential handoff

- Verified pre-remediation backup: `trackerx-data-20260910T150918Z-pre-security-remediation.zip`.
- Verified post-deployment scheduled/startup backups are present under the owner-only backend backup directory.
- Rotated temporary credentials are stored only at `/home/blockexe/TrackerX/security-rotation-20260910.txt` with mode `600`.
- Retrieve them from a key-authenticated SSH session, distribute each credential privately to its owner, and delete the rotation file after every affected account has changed its password.
- The server no longer accepts SSH password login or direct root login. Preserve and back up the private SSH key securely.

## Final conclusion

All confirmed code, database, credential, permission, host-access, and availability defects identified in this audit were remediated and verified in production. The release satisfies the current single-server deployment model. The residual items above define the next security and availability maturity step rather than hidden exceptions to the result.
