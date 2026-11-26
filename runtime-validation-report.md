# Runtime Validation Report

**Generated:** 2026-11-26  
**Target:** `C:\Users\SURAJIT\Desktop\nexboard-32`

## Summary

| Area | Result | Evidence |
|---|---|---|
| Frontend startup | PASS | `http://localhost:3000/board` returned HTTP 200 and rendered the board. |
| Backend health | FAIL | Configured API `http://localhost:4000/health` returned HTTP 404. |
| Board read | PASS | `GET /api/board` returned five tasks. |
| Frontend type-check | PASS | `pnpm exec tsc --noEmit`, exit code 0. |
| Backend type-check | PASS | `pnpm run typecheck`, exit code 0. |
| Browser checks | PARTIAL | Integrated browser exercised navigation, search/filter, theme, invite validation, profile dialog, and task creation. |
| Overall | FAIL | Task creation and My Tasks fail against the running API; named presence is not reported by its event stream. |

## Browser checks

| Feature | Result | Notes |
|---|---|---|
| Board rendering | PASS | Four status columns rendered with the API's five tasks. |
| Overview and Activity navigation | PASS | Both views opened and returned to the board. |
| Search and priority filters | PASS | Search updated the URL; priority filter updated the URL and Clear filters restored it. |
| Theme toggle | PASS | Dark/light toggle changed state in both directions. |
| Invite dialog | PARTIAL | Opens, validates invalid email, and closes. Actual delivery was not tested; the current UI uses `mailto:` rather than a backend invitation flow. |
| Profile dialog | PARTIAL | Opens and closes. Image upload/save was not tested. |
| Task creation | FAIL | Submitting a task returned HTTP 400: API expected lowercase assignee IDs (`surajit`, `anup`, `meera`, `rohan`) but the UI sent `Surajit`. No task was persisted. |
| My Tasks | FAIL | The selected user was `Surajit`; the API returns assignee `surajit`, and the view showed zero tasks despite matching tasks in the board data. |
| Named active-user presence | FAIL | Opened a second page and switched it to Maya; the first page did not show an active-user indicator. The SSE request produced no presence event data. |
| Edit, delete, drag-and-drop | UNVERIFIED | Not exercised because the running API/data contract is inconsistent; avoided mutating existing board data. |

## Other findings

- The running API's `/health` route returns 404, although the checked-in backend defines it. The running service may not match the current backend source.
- UI controls for notifications, sorting, board/column options, settings/help, project switching/addition, and keyboard shortcuts have no click handlers in the current frontend source.
- The standalone Playwright browser install was attempted but failed with `ENOSPC` while downloading Chromium. The integrated browser remained available for the checks above.
- Node.js is available (`v25.2.1`). Docker is unavailable, so database-backed integration validation was not run.

## Verdict

```text
environment:
  docker: UNAVAILABLE
  node: AVAILABLE — v25.2.1
  playwright: PARTIAL — integrated browser available; standalone Chromium install failed with ENOSPC
startup: FAIL — frontend route 200; configured backend /health 404
integration: UNVERIFIED — type-checks passed (exit_code: 0); no isolated database integration suite
e2e: PARTIAL — interactive browser checks; task creation and named presence failed; edit/delete/drag-and-drop unverified
overall: FAIL — runtime API contract does not match the UI, and current SSE stream does not provide named presence
```
