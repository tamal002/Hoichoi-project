# Nexboard — Collaborative Kanban Board

A collaborative Kanban board with a Next.js + TypeScript frontend (`nexboard/`) and a modular Node.js + Express + MongoDB backend (`backend/`).

## Project Structure

- `nexboard/` — Existing Next.js frontend (unchanged design/UI, connected to the backend via `NEXT_PUBLIC_API_URL`)
- `backend/` — Modular Node.js + Express + TypeScript + Mongoose backend
  - `src/config/` — Environment validation (`env.ts`) and MongoDB connection (`db.ts`)
  - `src/models/` — Mongoose schemas (`Task`, `Activity`, `Profile`)
  - `src/services/` — Business logic (`board.service.ts`), SSE pub/sub (`events.service.ts`), initial seeding (`seed.service.ts`)
  - `src/routes/` — Express routers (`board.routes.ts`, `tasks.routes.ts`, `events.routes.ts`, `profile.routes.ts`)
  - `src/middleware/` — Error handling and optional failure simulation (`error.ts`)

## How to Install and Run

### Prerequisites
- Node.js 20+
- `pnpm`

### 1. Backend
```bash
cd backend
pnpm install
cp .env.example .env
# Set MONGODB_URI in backend/.env (and ensure your IP is whitelisted in MongoDB Atlas)
pnpm dev
```
The backend runs on `http://localhost:4000` by default.

### 2. Frontend
```bash
cd nexboard
pnpm install
# nexboard/.env.local sets NEXT_PUBLIC_API_URL=http://localhost:4000
pnpm dev
```
The frontend runs on `http://localhost:3000`.

## API Endpoints

- `GET /health` — Server and MongoDB connection health check
- `GET /api/board` — Fetch all tasks (ordered by column & position), recent activity, and profile images
- `POST /api/tasks` — Create a task and broadcast `TASK_CREATED` + `ACTIVITY` over SSE
- `PATCH /api/tasks/:id` — Update task details or move/reorder across columns and broadcast `TASK_MOVED` / `TASK_UPDATED` + `ACTIVITY`
- `DELETE /api/tasks/:id` — Delete a task, re-index column positions, and broadcast `TASK_DELETED` + `ACTIVITY`
- `GET /api/events` — Server-Sent Events (SSE) stream for real-time collaboration
- `PUT /api/profile` — Update user avatar image

## What Is Complete and What Is Not

- **Complete**: Modular Node.js/Express/MongoDB backend, Zod request validation, automatic initial board seeding, column position normalization on drag-and-drop/delete, SSE real-time event streaming with heartbeats, optimistic UI updates + rollback, URL query state persistence, and frontend-to-backend wiring.
- **Note on MongoDB Atlas**: Ensure your current IP address (or `0.0.0.0/0` for development) is whitelisted in MongoDB Atlas Network Access so the backend can connect.

## Optimistic Updates and Rollback

- Creating, editing, deleting, and dragging tasks update React state immediately in `nexboard/components/nexboard.tsx` with an incremented optimistic `version`.
- If the backend request fails (e.g., network error or `503` simulated via `SIMULATE_FAILURE_RATE` or `x-simulate-failure: true`), the UI rolls back only the tasks matching the failed optimistic version, preserving any newer concurrent updates, and displays a toast notification.

## Real-Time Events Without Overwriting Local Changes

- Each task carries a monotonically increasing `version` number.
- Incoming SSE events (`TASK_CREATED`, `TASK_UPDATED`, `TASK_MOVED`, `TASK_DELETED`) deduplicate by `event.id` and only overwrite a local task when `remote.version >= local.version`, preventing stale remote events from clobbering newer optimistic/local state.
- `TASK_DELETED` events record deleted IDs in `remoteDeletedIds` so a failed local delete won't resurrect a task already deleted by another collaborator.

## Coding Agents Used

- Antigravity (Google DeepMind)

Built with v0 AI assistance; no external coding agent or service credentials are required.
