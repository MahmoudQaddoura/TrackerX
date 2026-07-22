# Changes 4 — Light Mode Default, Document Security, Employee Delegation & Roles

Status: implemented and verified locally (2026-07-22).

This update covers multiple improvements requested in a single session:

1. **Light mode made the default** — stale dark-theme artifacts are stripped on app boot.
2. **Document cross-project leak fixed** — TanStack Query now resets to `[]` when switching projects so stale documents never flash from a previously viewed project.
3. **CSV import sanitization** — the employee loader no longer creates team members from numeric values or overly short names that accidentally land in the assignee column.
4. **Professional roles assigned** — every seed employee now has their real-world title set in the database and displayed in the employee directory.
5. **Task delegation for departing employees** — a new backend endpoint and frontend UI let admins reassign all pending tasks from a deactivated employee to another active employee with one click.
6. **Employee directory redesigned** — split into Active / Deactivated sections with a collapsible Deactivated panel; deactivated cards show a "Delegate" button instead of edit/delete.
7. **Dr. Mohammad Alnabhan tagged as Owner** — a special amber Owner badge distinguishes him from regular employees in the directory and profile dialog.
8. **Role badge fixed in header** — the shell header now correctly shows Admin/PM/Developer/Client instead of the old binary "PM" / "Owner" mapping.

---

## 1. Light mode default

### What changed
- `frontend/src/main.tsx` now strips the `.dark` CSS class from `<html>` and clears the stale `localStorage` key `ptt_theme` before React renders, guaranteeing every fresh session starts in light mode.
- The dark-mode CSS variables remain in `globals.css` so the theme can be re-enabled later without any additional work.
- The `ThemeToggle` component remains in the source tree but is no longer rendered anywhere (already removed from `AppShell` and `LoginPage` in CHANGES_3).

### Files touched
- `frontend/src/main.tsx`

---

## 2. Document cross-project leak fix

### Problem
When navigating from Project A to Project B, the Documents tab briefly showed Project A's documents while the query for Project B was still loading. This was a TanStack Query cache staleness issue — the previous data stayed in the cache until the new query resolved.

### Fix
- `frontend/src/hooks/useDocuments.ts`:
  - Set `placeholderData: []` so the component receives an empty array while loading a new `projectId`.
  - Set `staleTime: 0` to treat cached data as immediately stale and trigger a refetch on every mount.
- The backend document endpoints were already correctly filtering by `project_id` — no backend changes were needed here.

### Files touched
- `frontend/src/hooks/useDocuments.ts`

---

## 3. CSV import sanitization

### Problem
CSV rows occasionally had numeric values (e.g., `"7"`) or very short strings in the assignee column that were incorrectly parsed as employee names, creating impossible team members like "7".

### Fix
- `backend/app/load_sample_project.py`:
  - Added `_is_valid_person_name()` — rejects purely numeric strings and names shorter than 3 characters.
  - Applied in both `_parse_jaf_csv()` (for JAF-style CSVs) and `_load_project()` (for standard CSVs).

### Files touched
- `backend/app/load_sample_project.py`

---

## 4. Professional roles in seed script

### What changed
- `backend/app/seed_roles.py` now includes a `PROFESSIONAL_ROLES` dictionary mapping each team member's name to their real-world job title.
- After creating user logins and linking them to team_member records, the script writes the professional role into `team_members.role`.
- Dr. Mohammad Alnabhan is handled specially: his team_member record (if created by the CSV loader) is tagged `"Owner"` and linked to his admin user account.

### Role assignments

| Employee | Professional Role |
|---|---|
| Yazan Abu Osbeh | Project Manager & Technical Lead |
| Mahmoud Qaddoura | Development Lead |
| Mohammad Al Balawi | Security Lead |
| Lina Khalil | Systems and Devops Engineer |
| Abed Al Qader Madi | AI Engineer |
| Yehya Mujahid | Full-stack Developer |
| Dr. Mohammad Alnabhan | Owner |

### Files touched
- `backend/app/seed_roles.py`

---

## 5. Task delegation endpoint

### Backend
- New endpoint: `POST /api/team-members/{member_id}/delegate-tasks`
  - Request body: `{ "to_member_id": int }`
  - Reassigns **all non-done tasks** from the source member to the target member.
  - Completed (`status = 'done'`) tasks are left untouched so historical attribution survives.
  - Returns: `{ from_member_id, from_member_name, to_member_id, to_member_name, tasks_reassigned }`
  - Admin-only (requires `require_admin` dependency).

### Frontend
- `frontend/src/api/team.ts` — new `delegateMemberTasks()` function calling the endpoint.
- `frontend/src/types/index.ts` — new `DelegateTasksPayload` and `DelegateTasksOut` interfaces.

### Files touched
- `backend/app/routers/team_members.py`
- `frontend/src/api/team.ts`
- `frontend/src/types/index.ts`

---

## 6. Employee directory redesign

### What changed
- The employee page is split into two sections:
  1. **Active Employees** — always visible card grid.
  2. **Deactivated Employees** — a collapsible panel (hidden by default, toggled with a chevron). Hidden when there are no deactivated employees.
- Deactivated employee cards show a **"Delegate Tasks"** button instead of edit/delete controls.
- Clicking "Delegate Tasks" opens a popup with a native `<select>` dropdown listing all active employees (excluding the deactivated member). Confirming reassigns all pending tasks.
- The existing **Profile drill-down dialog** remains unchanged for both active and deactivated members.
- The page header now shows: "N active · M deactivated".

### Files touched
- `frontend/src/pages/EmployeeListPage.tsx` (full rewrite)

---

## 7. Owner badge (Dr. Mohammad Alnabhan)

### What changed
- Employees whose `role === "Owner"` (set by `seed_roles.py`) display an amber **Owner** badge in their card and profile dialog.
- The badge uses `border-amber-500/50 bg-amber-500/10 text-amber-700` styling to visually distinguish the owner from other employees.
- Inactive employees who are also marked "Owner" show the Owner badge instead of the "Inactive" label.

### Files touched
- `backend/app/seed_roles.py`
- `frontend/src/pages/EmployeeListPage.tsx`

---

## 8. Header role badge fix

### What changed
- `AppShell.tsx` now maps all four roles to proper display labels: **Admin**, **PM**, **Developer**, **Client**.
- Previously it only handled `"pm"` and defaulted everything else to "Owner".
- The admin role gets `variant="default"` (accent-colored badge); all other roles get `variant="neutral"`.

### Files touched
- `frontend/src/components/layout/AppShell.tsx`

---

## Files changed (complete list)

### Backend — modified
- `backend/app/load_sample_project.py` — CSV name validation
- `backend/app/seed_roles.py` — professional role assignments, Owner handling
- `backend/app/routers/team_members.py` — new delegation endpoint

### Frontend — modified
- `frontend/src/main.tsx` — light-mode default enforcement
- `frontend/src/types/index.ts` — DelegationTaskPayload, DelegateTasksOut types
- `frontend/src/api/team.ts` — delegateMemberTasks function
- `frontend/src/components/layout/AppShell.tsx` — role badge labels
- `frontend/src/pages/EmployeeListPage.tsx` — full rewrite with sections + delegation
- `frontend/src/hooks/useDocuments.ts` — placeholderData + staleTime fix

---

## Verification

- **Backend**: `python3 -c "from app.main import app; print('OK')"` — compiles clean.
- **Frontend**: `npx tsc --noEmit` — zero errors.
- All files remain under the 500-line cap.

---

## Deployment notes

After pulling this update on the VPS, run the seed scripts:

```bash
cd backend
python3 -m app.load_sample_project
python3 -m app.seed_roles
pkill -f uvicorn || true
nohup uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/projectx-backend.log 2>&1 &
cd /opt/projectx/frontend
npm run build