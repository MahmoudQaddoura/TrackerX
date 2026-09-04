# TrackerX Security Audit — 5 September 2026

## Executive result

The supplied AI Tutor audits were used as a review framework, not as evidence about TrackerX. TrackerX has no LLM, RAG, or prompt-processing surface. The review covered authentication, authorization, request validation, files, exports, database access, browser controls, dependencies, configuration, and deployment.

No known critical dependency vulnerability or user-controlled raw-SQL injection path remains in the reviewed code. The high-risk findings discovered in this pass—browser-readable bearer tokens, missing login throttling, weak password acceptance, incomplete session invalidation, and two object-authorization inconsistencies—were remediated.

## Findings and disposition

| ID | Risk | Finding | Resolution |
|---|---:|---|---|
| TX-SEC-01 | High | JWT stored in browser local storage | Fixed: Secure/HttpOnly/SameSite cookie session; old local token is ignored and removed |
| TX-SEC-02 | High | No login throttling | Fixed: account and address buckets, generic failures, `429` and `Retry-After` |
| TX-SEC-03 | High | Weak passwords accepted on create/reset/change paths | Fixed: centralized 12–72 byte policy, 3 character classes, common/repeated/identity rejection |
| TX-SEC-04 | High | Role/password/access changes did not revoke prior tokens | Fixed: per-user `auth_version` embedded in JWT and incremented on security-sensitive changes |
| TX-SEC-05 | High | Client could fetch a non-client meeting by known ID | Fixed: detail authorization now matches the filtered meeting list |
| TX-SEC-06 | High | PM comment-delete rule could bypass project membership | Fixed: project access is checked before delete privileges |
| TX-SEC-07 | Medium | Cookie-authenticated writes lacked a CSRF signal | Fixed: unsafe API requests require `X-TrackerX-Request: 1`; cookie is SameSite=Strict |
| TX-SEC-08 | Medium | Development secret and broad runtime configuration could reach production | Fixed: production startup rejects placeholder secrets, wildcard/non-HTTPS origins, and wildcard hosts |
| TX-SEC-09 | Medium | Missing browser security headers | Fixed: CSP, HSTS, anti-framing, nosniff, referrer, permissions, COOP and CORP policies |
| TX-SEC-10 | Medium | Unbounded CSV and several JSON/text collections | Fixed: byte, row, cell, collection and text limits added |
| TX-SEC-11 | Medium | GitHub URL accepted arbitrary schemes/hosts | Fixed: HTTPS and GitHub-host allowlist |
| TX-SEC-12 | Medium | Health endpoint did not prove database readiness | Fixed: `SELECT 1`, explicit database status, and `503` on failure |
| TX-SEC-13 | Medium | Frontend transitive Browserslist advisory | Fixed: lockfile upgraded; npm audit now reports zero vulnerabilities |
| TX-SEC-14 | Informational | SQL injection review | SQLAlchemy parameterization is used for user data; remaining raw SQL is static migration/backup SQL with fixed identifiers |

## Authorization model checked

- Owners/admins retain global management rights.
- Project managers and employees require project membership for project objects.
- Clients see direct projects plus linked maintenance workspaces, but only explicitly forwarded proactive/incident reports.
- Employee profile files remain staff-scoped; project documents and assets follow project access rules.
- File previews force risky browser-renderable types such as HTML/SVG to plain text.

## Dependency evidence

- Python: `pip-audit -r requirements.txt` — no known vulnerabilities.
- JavaScript: `npm audit --json` — 0 low, moderate, high, or critical vulnerabilities after remediation.

## Residual deployment risks

These are explicit operating constraints, not hidden claims of perfection:

1. The login limiter is process-local. Use Redis or another shared atomic store before running multiple API replicas.
2. Uploaded files have size/type controls but no malware scanner. Add quarantining and scanning for untrusted public uploads.
3. MFA is not implemented. Require it before exposing privileged accounts to a high-risk public environment.
4. TLS is terminated outside the application. Deployment must use an HTTPS reverse proxy and protected database/backup volumes.
5. A professional penetration test remains necessary before a high-assurance Internet launch.

## OWASP coverage summary

- A01 Broken Access Control: project and client boundary review plus targeted fixes.
- A02 Cryptographic Failures: password hashing retained; JWT secret and secure-cookie production rules strengthened.
- A03 Injection: parameterized ORM review, fixed raw-SQL identifiers, length/type validation.
- A04 Insecure Design: explicit client forwarding and incident/proactive workflow boundaries.
- A05 Security Misconfiguration: trusted hosts, CORS validation, headers, disabled production docs.
- A06 Vulnerable Components: Python and npm audits integrated into CI.
- A07 Authentication Failures: password policy, throttling, cookie auth, revocation version.
- A08 Integrity Failures: locked dependencies and CI audit gates.
- A09 Logging/Monitoring: health/readiness improved; centralized security-event aggregation remains an operations task.
- A10 SSRF: externally supplied project URLs are allowlisted to HTTPS GitHub; no general server-side URL fetcher was found.
