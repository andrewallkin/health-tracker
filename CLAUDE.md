# health-tracker

Personal nutrition tracker with AI food estimation, daily check-ins, and Garmin research tooling.

Three main app sections:

- **Food** — log meals, track macros, AI photo/text estimation, day/week/month dashboards
- **Check-in** — daily weight and progress photos
- **Health** — Garmin-style activity views (mock data only; live Garmin not wired yet)

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI API, SQLAlchemy models, Alembic migrations, `MacrosEstimator` |
| `frontend/` | React dashboard (Vite + TypeScript + Tailwind v4) |
| `notebooks/` | Jupyter demos (Garmin API, food vision) — not connected to the app |
| `scripts/` | Utility scripts (DB seeding, Garmin demo) |
| `tests/fixtures/` | Test images for notebooks and integration tests |

## Commands

```bash
# Install all Python deps (workspace root)
uv sync --all-packages --all-groups

# Backend only (matches Docker image)
uv sync --project backend --all-groups

# Run migrations
./backend/run_migrations.sh

# Dev stack (Postgres + backend + frontend)
docker compose -f docker-compose.dev.yml up -d

# Backend locally
uv run --project backend uvicorn backend.main:app --reload --port 8000

# Frontend locally
cd frontend && npm install && npm run dev

# Tests (must pass before claiming work is done)
uv run --project backend pytest
cd frontend && npm test && npm run lint && npx tsc -b

# Seed demo data
uv run python scripts/seed_db.py --reset   # demo@example.com / password123
```

Copy `.env.example` to `.env` before running. Required vars: `POSTGRES_*`, `SETTINGS_ENCRYPTION_KEY`, `JWT_SECRET_KEY`. See README for full list.

Dev URLs: **http://localhost:3000** (Docker frontend) or **http://localhost:5173** (Vite). Both proxy `/api` to the backend on port 8000.

## Architecture

### Backend (FastAPI)

- Routes in `backend/api/routes/`; all mounted under `/api` in `backend/main.py`:
  `auth`, `users`, `goals`, `meals`, `entries`, `settings`, `estimate`, `photos`, `check_ins`
- Pydantic schemas in `backend/api/schemas.py` — JSON uses **camelCase** (`imageUrl`, `logDate`, etc.)
- SQLAlchemy rows in `backend/db_models.py` — DB columns use **snake_case**
- `backend/api/mappers.py` converts rows ↔ schemas; reuse mappers instead of inline dicts
- `backend/api/ownership.py` — always scope queries by `user_id`
- `backend/api/deps.py` — `get_current_user`, `get_macros_estimator` (requires encrypted OpenAI key)
- Auth: JWT access tokens + httpOnly refresh cookies; per-user data isolation
- AI estimation: `backend/food_classifier.py` (`MacrosEstimator`), exposed at `POST /api/estimate`
- Photos: local disk in dev (`data/meal-photos/`, gitignored), GCS with signed URLs in prod
- Goals: `GET /api/goals` returns **404** until the user configures goals; `PUT /api/goals` creates or updates

### Frontend (React)

**Routing (React Router)** — `frontend/src/AppRouter.tsx`:

- Public: `/login`, `/register`
- Protected: `/onboarding/goals` → main app at `/*`
- `RequireGoalsConfigured` redirects to onboarding when `GET /goals` returns 404

**In-app navigation (state machine)** — `App.tsx` uses `AppView` + `AppSection`:

- `AppSection`: `nutrition | health | check-in` (top bar tabs)
- `AppView`: dashboard flows (`today`, `add-food`, `estimate-review`, `check-in`, etc.)
- Dashboard shell: `MainDashboardShell` (today/week/month tabs); sub-flows: `AppFlowViews`

**Data & API:**

- `frontend/src/lib/client.ts` — fetch wrapper, token refresh, `ApiError`
- `frontend/src/lib/api.ts` — typed nutrition/check-in/settings endpoints
- `frontend/src/lib/authApi.ts` — login, register, logout
- Types in `frontend/src/types/` mirror backend schemas

**Context providers** (`main.tsx`): `AuthProvider`, `ConfirmDialogProvider`

**Hooks:** `useNutritionData`, `useCheckInData`, `useEstimateFlow`

**Shared lib helpers:** `dates.ts`, `aggregates.ts`, `logLabels.ts`, `logEntry.ts`, `mealPhoto.ts`, `checkIn.ts`, `errors.ts`

**Components** by feature: `nutrition/`, `checkin/`, `health/`, `layout/`, `shared/`

**Health section** reads from `frontend/src/data/mockHealth.ts` — not the backend.

**Styling:** Tailwind v4 with custom theme tokens in `index.css` (`color-scheme: dark`). Use existing surface/macro color tokens; don't add light-mode-only styles.

### Database

- PostgreSQL in dev/prod; SQLite in-memory for pytest (`backend/tests/conftest.py`)
- Alembic migrations in `backend/alembic/versions/` — add a new revision for schema changes; never edit applied migrations
- Run `./backend/run_migrations.sh` after adding migrations

## Domain model

### Nutrition

1. **Daily goal** — fixed daily calorie + macro targets (one row per user; must be set before app access)
2. **Saved meal** — reusable template: name, description, macros, optional photo
3. **Log entry** — food eaten on a date/slot with servings multiplier; optionally linked to a saved meal

Meal upload flow: describe and/or photo → AI estimate (`MacrosEstimator`) → user review/edit → log to day and/or save as meal.

### Check-in

One check-in per user per date: weight, notes, progress photos (up to multiple, ordered).

## Coding conventions

### General

- Minimize scope — match existing patterns; don't refactor unrelated code
- Don't commit `.env`, secrets, or `data/meal-photos/`
- Don't create git commits or push unless explicitly asked
- Verify with tests before claiming work is complete

### Python

- Python 3.11+, managed with **uv** (not pip directly)
- Use `from __future__ import annotations` in new modules
- FastAPI routes return Pydantic schemas, not raw ORM rows
- New routes need `Depends(get_current_user)` unless public (auth endpoints only)
- Add pytest coverage in `backend/tests/` for new API behavior

### TypeScript / React

- Functional components; keep UI in components, logic in `hooks/` and `lib/`
- Use `useConfirm()` from `ConfirmDialogProvider` for destructive actions — **never** `window.confirm`
- Vitest for unit tests in `frontend/src/lib/*.test.ts`
- Form inputs use `text-base` (16px) minimum to avoid mobile Safari zoom on focus

### API contract

- Authenticated endpoints: `Authorization: Bearer <token>`
- Errors: FastAPI `{ "detail": "..." }` shape
- Dates: `YYYY-MM-DD`; times: `HH:MM`
- Meal slots: `breakfast | lunch | dinner | snack`

## What's done vs deferred

**Done:** Food logging, saved meals, AI estimate + review flow, goals + onboarding, day/week/month views, auth, check-ins, shared confirm dialog, Docker/CI deploy.

**Next (polish):** Midnight auto-rollover when app stays open past midnight, export week/month summaries, improve AI estimate text formatting.

**Deferred — do not implement unless asked:**

- Garmin integration / live Health section data
- Varying daily goals (rest vs training day)
- Chat / recipe UI
- PWA, barcode OCR, production infra (nginx/SSL)

## Common tasks

| Task | Where to look |
|------|---------------|
| Add API endpoint | `backend/api/routes/`, register in `backend/main.py` |
| Change DB schema | `backend/db_models.py` + new Alembic migration |
| Add in-app screen | Extend `AppView` in `types/nutrition.ts`, handle in `AppFlowViews` |
| Add router page | `frontend/src/pages/`, wire in `AppRouter.tsx` |
| Change AI models | `backend/api/routes/settings.py`, defaults in `mappers.py` |
| Photo upload/storage | `backend/api/photo_storage.py`, `backend/api/routes/photos.py` |
| Auth flow | `backend/api/routes/auth.py`, `frontend/src/context/AuthProvider.tsx` |
| Destructive UI action | `useConfirm()` hook, `ConfirmDialog` component |

## CI / deploy

PRs: backend pytest + frontend test/lint/tsc (`.github/workflows/ci.yml`).

Push to `main`: build Docker images, deploy to VPS, run migrations (`.github/workflows/deploy.yml`).

Production uses external Postgres (`postgres-net`) and GCS for photos.
