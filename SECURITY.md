# TrackerX security policy

## Supported deployment

TrackerX is currently designed for one trusted production API instance behind an HTTPS reverse proxy. Production startup refuses placeholder JWT secrets, wildcard hosts, wildcard CORS origins, and non-HTTPS CORS origins.

## Account controls

- Passwords are 12–72 UTF-8 bytes and must use at least three character classes.
- Common, repeated, and identity-derived passwords are rejected.
- Authentication uses a Secure, HttpOnly, SameSite=Strict session cookie.
- Password, role, access, enabled-state, and client-email changes invalidate previous sessions.
- Repeated login failures are throttled. Multi-instance deployments must replace the in-process throttle with a shared store such as Redis.

## Reporting a vulnerability

Do not place credentials, personal information, production database copies, or exploit details in a public issue. Send the affected route, reproduction steps, impact, and suggested fix to the private project owner. Rotate exposed secrets immediately.

## Deployment checklist

Use a unique 32-byte-or-longer JWT secret, HTTPS-only origins, an exact public hostname, encrypted off-site backups, restricted upload storage, and periodic dependency audits. Keep API documentation disabled in production and do not expose the backend port directly to the Internet.
