# TrackerX Remediation Report — 5 September 2026

## Delivered controls

Authentication now uses an HttpOnly cookie, shortens the session lifetime to two hours, validates issuer/audience/JTI/version claims, supports logout, and revokes old sessions after security-sensitive account changes. Password rules apply consistently to owners, employees, clients, resets, and password changes. Login failures are throttled without exposing whether an account exists.

Authorization was rechecked route-by-route. Direct meeting reads and comment deletion now enforce the same project boundary as list and write operations. Client report access remains an explicit forward/share workflow rather than automatic access to internal evidence.

Input and file paths now have practical limits. CSV import is capped by bytes, rows and cell length; upload names and descriptions are bounded; large report/task fields and identifier lists are capped. Project GitHub links accept only HTTPS GitHub URLs. Database access continues through parameterized SQLAlchemy operations; static migration and backup SQL uses fixed identifiers.

Deployment was strengthened with trusted hosts, strict production CORS validation, database readiness, browser security headers, disabled production API docs, pinned audit tooling, and an automated quality gate.

## Password policy

- 12 character minimum and 72 UTF-8 byte maximum.
- At least three of lowercase, uppercase, number and symbol.
- Rejects common passwords, six-character repetition, and passwords containing meaningful name/email tokens.
- Current password is required for self-service change; the replacement must differ.
- Password resets and changes invalidate earlier sessions.

## Verification record

| Check | Expected |
|---|---|
| Backend unit/security suite | All tests pass |
| Python compile check | No syntax failures |
| Frontend production build | TypeScript and Vite build succeed |
| Python dependency audit | No known vulnerabilities |
| npm dependency audit | No known vulnerabilities |
| Ruff correctness scan | No configured correctness violations |

Exact command results are recorded in the final task handoff and can be reproduced by `.github/workflows/ci.yml`.

## Scope clarification

The uploaded AI Tutor reports describe another system. Their security and engineering categories were applied to TrackerX, but AI-model, RAG, prompt-injection, and vector-store findings are not applicable because those components do not exist in this codebase.
