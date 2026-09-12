# TrackerX flexible Excel import — 12 September 2026

## Outcome

Kanban and Asset Inventory now accept supported external `.xlsx` tables without requiring the TrackerX export template. TrackerX locates the table header, recognizes familiar column labels, previews the exact mapping and defaults, and applies the validated records through the existing atomic import transaction.

The import remains deterministic: it uses a reviewed synonym map and validation rules, not an AI service or probabilistic data upload. A preview is mandatory and no database write occurs until the user confirms it.

## VerifyX networking workbook

The supplied `VerifyX & AI Knowledge Base Backup Networking Requirements .xlsx` workbook is recognized as a network allowlist from the `NFS_backup_allowlist` worksheet. Its 10 source rows map as follows:

- `Source role` and `Source IP` become source assets.
- `Destination` and `Destination IP` become destination assets.
- `Port` becomes a destination port.
- `Protocol` becomes the transport protocol; combined values such as `TCP, UDP` expand into independent rules.
- `What is copied / notes` is preserved in asset and port context.
- Repeated endpoints are consolidated by canonical IP address.

The validated preview produces 6 unique assets, 3 destination port/protocol records, and 15 source-to-port connectivity rules. Missing environment is visibly defaulted to `Other` for later completion, and missing connection state is visibly defaulted to `Connected / required`. The user can change both defaults before import.

## Kanban inference

- Recognizes task, activity, action, work-item, phase, milestone, status, assignee, schedule, estimate, and delay columns.
- Accepts employee numbers, exact employee names, and linked login email addresses for assignee matching.
- Normalizes familiar status labels such as `In Progress`, `QA`, `On Hold`, and `Complete` to TrackerX statuses.
- Groups task-only sheets by their milestone/phase value, or by worksheet name when a milestone column is absent.
- Leaves unmatched assignees and missing optional data for manual completion with explicit preview warnings.
- External rows without TrackerX IDs create new work; updates require a valid project-owned TrackerX ID.

## Asset inference and merge safety

- Recognizes asset registers and source/destination network allowlists.
- Uses normalized IP address as the strongest asset identity and creates unique, readable hostnames when none are supplied.
- Preserves existing manually enriched asset fields when an external sheet omits them.
- Reuses existing assets, ports, and connections on repeated upload instead of duplicating records.
- Enforces the existing environment-scoped connectivity rule and blocks ambiguous cross-environment merges.
- Never deletes records that are absent from an imported workbook.

## Security and validation

- Existing 8 MB upload, 5,000-row, 100-column, 50 MB expanded-package, and OOXML file-count limits remain enforced.
- Macros, external workbook links, unsafe XML entities, invalid worksheet targets, duplicate package entries, and formula-backed import fields remain rejected.
- Project access and edit permissions are checked before parsing or applying records.
- Imports are validated before commit and applied in one database transaction.
- Wrong-workspace uploads are blocked with an actionable route to Kanban or Asset Inventory.

## Verification

- Supplied VerifyX workbook preview: passed; 10 rows, 96% recognized mapping confidence, 6 assets, 3 ports, 15 connections.
- Supplied VerifyX workbook commit against a disposable database: passed.
- Re-import idempotency check: passed; no duplicate assets, ports, or connections.
- Backend regression suite: 60 tests passed.
- Ruff static analysis: passed.
- Frontend TypeScript validation and production Vite build: passed.
