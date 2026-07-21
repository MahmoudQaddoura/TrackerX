# Database Documentation — Project Task Tracker

The backend uses **SQLite** through **SQLAlchemy 2.0**. The schema is created automatically on startup by `Base.metadata.create_all()` (see `backend/app/main.py`) — there is no migration tool, keeping things simple. To move to PostgreSQL, only change `DATABASE_URL`; the models are portable.

## Conventions

- **Timestamps & dates** are stored as ISO-8601 **strings** (`created_at`, `updated_at`, `start_date`, …). `db.now_iso()` produces timestamps; dates are `YYYY-MM-DD`.
- **Booleans** are stored as integers `0/1` (`is_delayed`, `is_active`).
- **Enums** are enforced with SQLite `CHECK` constraints, not native enum types.
- **Cascades**: deleting a project deletes its milestones, tasks, meetings, and documents. Deleting a milestone deletes its tasks. Deleting a team member sets assigned tasks' `assigned_member_id` to `NULL`.

## Connection lifecycle (`backend/app/db.py`)

```
create_engine(DATABASE_URL, connect_args={"check_same_thread": False})   # SQLite-safe
SessionLocal = sessionmaker(bind=engine)
get_db()  ->  yields a Session per request (FastAPI dependency), always closed
```
Every router receives its session via `Depends(get_db)`. The SQLite file lives at `backend/data/app.db` (created if missing); uploaded document bytes live under `backend/data/documents/`.

---

## Entity-relationship overview

```
users (auth: pm | owner)
   └─ (author_id, no FK) ──< comments >── (entity_type, entity_id) ──> tasks | milestones

projects 1───∞ milestones 1───∞ tasks ∞───1 team_members
   │                │                         (assigned_member_id, SET NULL)
   │                └───∞ documents
   ├───∞ meetings
   └───∞ documents            (documents.milestone_id is optional)
```

- **projects → milestones → tasks** is the core hierarchy (cascade delete downward).
- **team_members** is a standalone directory; a task optionally points at one via `assigned_member_id`.
- **documents** always belong to a project and may additionally belong to a milestone.
- **meetings** belong to a project.
- **comments** attach polymorphically to a task or a milestone, and reference the authoring user by `author_id`.

---

## Tables

### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| email | TEXT | UNIQUE, indexed, NOT NULL |
| hashed_password | TEXT | NOT NULL (bcrypt) |
| full_name | TEXT | NOT NULL |
| role | TEXT | NOT NULL, `CHECK role IN ('pm','owner')` |
| created_at | TEXT | NOT NULL |

### `projects`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| name | TEXT | NOT NULL |
| description | TEXT | nullable |
| status | TEXT | NOT NULL, default `active`, `CHECK IN ('active','on_hold','completed','archived')` |
| start_date / end_date | TEXT | nullable (ISO date) |
| created_at / updated_at | TEXT | NOT NULL (`updated_at` auto-updates) |

**Children:** `milestones`, `meetings`, `documents` (all `ON DELETE CASCADE`).

### `milestones`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| project_id | INTEGER | FK → `projects.id` ON DELETE CASCADE, indexed, NOT NULL |
| title | TEXT | NOT NULL |
| description | TEXT | nullable |
| start_date / end_date | TEXT | nullable |
| sort_order | INTEGER | NOT NULL, default 0 |
| created_at / updated_at | TEXT | NOT NULL |

**Children:** `tasks` (CASCADE), `documents` (documents' `milestone_id`).

### `tasks`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| milestone_id | INTEGER | FK → `milestones.id` ON DELETE CASCADE, indexed, NOT NULL |
| title | TEXT | NOT NULL |
| description | TEXT | nullable |
| start_date / end_date | TEXT | nullable (drive the Gantt) |
| status | TEXT | NOT NULL, default `todo`, indexed, `CHECK IN ('todo','in_progress','in_review','blocked','delayed','done')` |
| is_delayed | INTEGER | NOT NULL, default 0, `CHECK IN (0,1)` |
| delay_cause | TEXT | nullable, `CHECK IN ('Company','Client') OR NULL` |
| delay_comment | TEXT | nullable |
| est_days | REAL | nullable (estimated effort, preserved from CSV import) |
| assigned_member_id | INTEGER | FK → `team_members.id` ON DELETE SET NULL, indexed, nullable |
| sort_order | INTEGER | NOT NULL, default 0 |
| created_at / updated_at | TEXT | NOT NULL |

**Rule enforced in the API:** status `delayed` implies `is_delayed = 1`; any delayed task must have a `delay_cause`.

### `team_members`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| name | TEXT | NOT NULL |
| role | TEXT | nullable (free text, e.g. "Backend Engineer") |
| is_active | INTEGER | NOT NULL, default 1 (soft-delete flag) |
| created_at / updated_at | TEXT | NOT NULL |

**Referenced by:** `tasks.assigned_member_id` (SET NULL on delete). Delete is a soft delete so historical assignments survive.

### `documents`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| project_id | INTEGER | FK → `projects.id` ON DELETE CASCADE, indexed, NOT NULL |
| milestone_id | INTEGER | FK → `milestones.id` ON DELETE CASCADE, indexed, nullable |
| category | TEXT | NOT NULL, indexed, `CHECK IN ('technical','meeting_minutes','business')` |
| title | TEXT | NOT NULL |
| description | TEXT | nullable |
| file_name | TEXT | NOT NULL (original filename) |
| file_path | TEXT | NOT NULL (on disk; **never returned by the API**) |
| content_type | TEXT | nullable |
| file_size | INTEGER | nullable (bytes) |
| uploaded_by_id | INTEGER | FK → `users.id` ON DELETE SET NULL, nullable |
| created_at / updated_at | TEXT | NOT NULL |

**Disk layout:** `data/documents/<project_id>/<milestone_id?>/<category>/<uuid>_<safe_name>`. Max upload 10 MB.

### `meetings`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| project_id | INTEGER | FK → `projects.id` ON DELETE CASCADE, indexed, NOT NULL |
| meeting_type | TEXT | NOT NULL, default `sprint`, indexed, `CHECK IN ('sprint','client')` |
| title | TEXT | NOT NULL |
| meeting_date | TEXT | NOT NULL (ISO date) |
| discussion_points | TEXT | nullable (the minutes/notes) |
| outcome | TEXT | nullable |
| created_at / updated_at | TEXT | NOT NULL |

### `comments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| entity_type | TEXT | NOT NULL, `CHECK IN ('task','milestone')` |
| entity_id | INTEGER | NOT NULL, indexed (no FK — polymorphic) |
| author_id | INTEGER | references `users.id` (view-only relationship, no FK column) |
| body | TEXT | NOT NULL |
| created_at / updated_at | TEXT | NOT NULL |

Both PMs and owners can create comments; a comment may be deleted by its author or any PM.

---

## Computed (not stored) fields

These are derived at read time by `services/` and returned in `*Out` responses — they are **not** columns:

- **`progress_pct`** (milestone/project): `100 × done_tasks / total_tasks` (`services/progress.py`).
- **`is_delayed`** (milestone/project): true if any task is delayed.
- **`risk_level`** (task/milestone/project): `on_track` / `at_risk` / `overdue` / `unknown` from status vs. schedule (`services/risk.py`); roll-ups take the worst.
- **Analytics** (`services/analytics.py`): KPI summary, status breakdown, per-project progress, delayed-task list.

## Seed data (`backend/app/seed.py`)

Idempotent. Creates two users — `pm@demo.com` (PM) and `owner@demo.com` (Owner), password `ChangeMe123!` — four team members, and three sample projects (one active with a delay, one active/on-track, one completed) with milestones, dated tasks across all statuses, and sprint meetings.
