# Changes 3 — TrackerX Branding, GitHub Project Links, and UI Polish

Status: implemented and verified locally (2026-07-21).

This update covers the three frontend-focused changes requested in the latest session:
1. Rebranding the app to TrackerX and applying the provided logo to the UI.
2. Adding a clean GitHub repository button for each project.
3. Updating the secondary UI color to #0b4b7f and removing the visible dark-mode toggle while preserving the theme code for future re-enable.

---

## 1. TrackerX rebrand

### What changed
- The app title now reads TrackerX in the browser tab, login screen, and header branding.
- The provided x.PNG logo is used as the main application logo in the brand bar.
- The favicon was also updated to use the same TrackerX image.

### Files touched
- frontend/src/components/layout/BrandLogo.tsx
- frontend/src/pages/LoginPage.tsx
- frontend/index.html

---

## 2. Project GitHub repository button

### What changed
- Each project now has a GitHub button.
- Clicking the button opens the linked repository directly for all users when a URL is configured.
- Admin users can still open the same button to edit or save the repository URL through a compact popup.
- The flow was kept compact and visually consistent with the rest of the UI.

### Files touched
- frontend/src/components/project/ProjectGitHubButton.tsx
- frontend/src/pages/ProjectDetailPage.tsx
- frontend/src/pages/ProjectsPage.tsx

---

## 3. UI color and theme polish

### What changed
- The secondary accent color was updated to #0b4b7f.
- The visible dark-mode switch was removed from the shell and login screen.
- The overview progress KPI now uses a percentage-style icon instead of the same icon used for total tasks, making the card visually clearer.
- The theme mechanism remains in place in the codebase so it can be reintroduced later without extra setup.

### Files touched
- frontend/src/styles/globals.css
- frontend/src/components/layout/AppShell.tsx
- frontend/src/pages/LoginPage.tsx

---

## Verification
- The frontend build completed successfully with `npm run build`.
