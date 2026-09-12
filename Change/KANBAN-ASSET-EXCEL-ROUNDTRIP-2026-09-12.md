# TrackerX Kanban and Asset Excel Round-Trip

Release date: 12 September 2026
Feature branch: `feat/kanban-asset-excel-roundtrip`

## Outcome

TrackerX now provides one guided Excel workflow in both the Kanban board and Asset Inventory. An authorized user can export the complete current workspace, download a clean TrackerX template, upload a completed `.xlsx` file, review a server-generated change preview, and explicitly commit the validated changes.

The import is a merge, not a replacement. A populated stable ID updates a record in the current project, a blank ID creates a record, and a row that is absent from the workbook is not deleted.

## Kanban workbook

The workbook contains:

- `Instructions`: field rules, create/update behavior, allowed values, date format, assignee rules, and the mandatory preview workflow.
- `Milestones`: stable ID, title, description, dates, sort order, calculated task totals/progress/risk, and audit timestamps.
- `Tasks`: stable task and milestone IDs, milestone title, task content, workflow status, employee-number and name assignees, dates, estimate, delay cause/comment, sort order, risk, and audit timestamps.

The importer validates milestone ownership, milestone/task duplicates, supported task states, date ranges, estimates, delay data, and assignees. Project managers may assign only employees on that project’s roster. Employee numbers are the stable spreadsheet identity; names remain readable context.

## Asset Inventory workbook

The workbook contains the complete inventory view:

- `Overview`
- `Assets`
- `Ports`
- `Connectivity Matrix`
- `Connection Log`

Imports use `Assets`, `Ports`, and `Connection Log` as the authoritative tables. TrackerX rebuilds the Connectivity Matrix from the validated asset/port/connection relationships so the table and export cannot drift apart.

Validation covers project ownership, stable IDs, unique hostname and IP address, valid IP syntax, environments, lifecycle statuses, port range and protocol, duplicate port definitions, source/destination asset resolution, same-environment connections, connection state, and cross-project references.

## Permissions

- Export follows existing project read access.
- Kanban templates and imports require project management access: owner/administrator or the project’s assigned manager.
- Asset templates and imports require project content-edit access.
- Client and read-only users may export only when their existing project scope permits it; they cannot import.
- The server rechecks permissions for every request. UI visibility is not treated as authorization.

## Security and reliability controls

- Only `.xlsx` uploads are accepted; the request limit is 8 MB.
- ZIP entries, expanded content, worksheet count, row count, column count, and individual entry size are bounded.
- XML is parsed with `defusedxml`.
- Macro payloads and external workbook links are rejected.
- Formula cells in imported fields are rejected rather than evaluated.
- IDs must belong to the selected project; cross-project updates are rejected.
- All rows are validated before mutation. Commit is atomic and rolls back on error.
- Preview performs no database writes and returns exact sheet/row/field errors plus create/update counts.
- The frontend invalidates Kanban, Gantt, analytics, asset, matrix, and project caches after a successful commit.

## API surface

- `GET /api/projects/{project_id}/kanban/excel`
- `GET /api/projects/{project_id}/kanban/excel-template`
- `POST /api/projects/{project_id}/kanban/import-excel`
- `GET /api/projects/{project_id}/assets/excel-template`
- `POST /api/projects/{project_id}/assets/import-excel`
- Existing current-data asset export remains `GET /api/projects/{project_id}/assets/export/excel`.

Both upload endpoints accept multipart `file` and `commit`. `commit=false` is the required preview pass; `commit=true` applies the same validated workbook.

## Verification evidence

- Python compilation: passed.
- Ruff backend/test lint: passed.
- Frontend TypeScript and Vite production build: passed.
- Backend/API regression suite: 57 tests passed, including the malicious-workbook rejection and native Excel-date cases.
- Feature regression coverage verifies Kanban preview/commit, stable-ID round trip, asset/port/connection creation, and matrix-state persistence.
- Security regression coverage verifies that a workbook containing a macro payload is rejected.
- Both generated templates were independently imported, inspected, exported again, and rendered with the spreadsheet artifact runtime. All expected sheets and fields survived the round trip, formulas were enumerated, and the rendered TrackerX layout passed visual inspection.
- `httpx2` is pinned with the backend dependencies so the FastAPI/Starlette API-integrity suite is reproducible in the deployment environment.

The deployed commit is recorded in the release handoff.
