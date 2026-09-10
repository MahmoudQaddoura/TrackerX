# TrackerX API integrity audit — 10 September 2026

## Outcome

TrackerX exposes 80 OpenAPI paths and 111 API operations. Every method/path pair and every OpenAPI operation identifier is unique. The backend compiles, passes Ruff static analysis, and the complete 40-test regression suite passes.

## Production defect remediated

Milestone create, update, and delete called `check_project_manage_access` without importing it into the milestones router. This caused a server-side `NameError` and returned HTTP 500 when an authorized owner or project manager saved a milestone. The meetings router contained the same latent defect.

Both routers now import and apply the shared project-management authorization boundary. Regression tests exercise project-manager create, update, and delete operations for both resources.

## Employee profile files

Profile-file upload, listing, preview, download, and deletion were reviewed as one permission-scoped workflow:

- Administrators can manage files for every employee.
- An employee can view, upload, download, preview, and remove files only on their own linked profile.
- Project managers cannot access another employee's private CV files merely because they manage a project.
- Clients cannot access internal employee profile files.
- Uploads retain extension, count, filename-length, empty-file, and 50 MB size validation, use generated storage keys, and roll back database and object-storage writes together on failure.

## Verification evidence

- `python -m compileall -q backend/app`: passed.
- `ruff check backend/app backend/tests`: passed.
- `python -m unittest discover -s backend/tests -p 'test_*.py'`: 40 passed.
- OpenAPI contract inventory: 80 paths, 111 unique method/path operations, 111 unique operation IDs.
- `pip-audit -r backend/requirements.txt`: no known vulnerabilities.
- `npm audit --omit=dev`: no known vulnerabilities.
- Production frontend build (`tsc --noEmit` and Vite): passed.

This audit validates route registration, code integrity, targeted authorization behavior, dependency advisories, and the corrected workflows. It does not claim that every possible business-data combination has been exercised in production.
