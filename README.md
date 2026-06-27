# health-tracker

Personal nutrition tracker with AI food estimation, daily check-ins, and Garmin research tooling.

The app has three main sections:

- **Food** — log meals, track macros, AI photo/text estimation, day/week/month dashboards
- **Check-in** — daily weight and progress photos
- **Health** — Garmin-style activity views (UI stub; live data not wired yet)

## Project structure

| Folder | Description |
|--------|-------------|
| [`backend/`](backend/) | FastAPI app, PostgreSQL via SQLAlchemy, Alembic migrations, `MacrosEstimator` |
| [`frontend/`](frontend/) | React dashboard (Vite + TypeScript + Tailwind) |
| [`notebooks/`](notebooks/) | Jupyter notebooks for Garmin API and food vision demos |
| [`scripts/`](scripts/) | Utility scripts (Garmin demo, DB seeding) |
| [`tests/fixtures/`](tests/fixtures/) | Test input images for notebooks and integration tests |

## Quick start

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python 3.11+)
- Node.js 20+ (for local frontend dev)
- Docker (recommended for Postgres + full stack)

### 1. Environment

```bash
uv sync --all-packages --all-groups
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Notes |
|----------|----------|-------|
| `POSTGRES_*` | Yes | Database connection (see `.env.example`) |
| `SETTINGS_ENCRYPTION_KEY` | Yes | Encrypts per-user OpenAI keys in the DB |
| `JWT_SECRET_KEY` | Yes | Auth signing secret (use a strong value in production) |
| `CORS_ORIGINS` | Dev | Comma-separated frontend origins |
| `GCP_SERVICE_ACCOUNT_CREDENTIALS` | Prod | Base64 service account JSON for GCS photo storage |
| `GCS_IMAGES_BUCKET_NAME` | Prod | Bucket for meal and check-in photos |

Generate an encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 2. Run with Docker (recommended)

Starts Postgres, backend (with hot reload), and frontend dev server:

```bash
docker compose -f docker-compose.dev.yml up -d
./backend/run_migrations.sh
```

Optional — seed demo data:

```bash
uv run python scripts/seed_db.py --reset
```

Then open **http://localhost:3000** and sign in with `demo@example.com` / `password123`, or register at `/register`.

Add your OpenAI API key in the app **Settings** screen (stored encrypted in PostgreSQL).

### 3. Run locally (without Docker frontend)

With Postgres running (via Docker or otherwise) and `.env` pointing at it:

```bash
./backend/run_migrations.sh
uv run --project backend uvicorn backend.main:app --reload --port 8000

cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the backend on port 8000.

Backend-only dependency sync (matches the Docker image):

```bash
uv sync --project backend --all-groups
```

### Tests

```bash
uv run --project backend pytest
cd frontend && npm test
```

## Production deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. Build and push backend/frontend Docker images to Docker Hub
2. Deploy to VPS via SSH with `docker-compose.yml`
3. Run Alembic migrations inside the backend container

Production uses an external Postgres network (`postgres-net`) and GCS for photo storage. See `.env.example` for all production variables.

## Research

Garmin Connect exploration lives in notebooks and scripts — not connected to the main app yet.

Install the Jupyter kernel once:

```bash
uv run python -m ipykernel install --user --name health-tracker --display-name "Health Tracker"
```

Notebooks:

- `notebooks/explore.ipynb` — Garmin Connect API exploration
- `notebooks/food_estimate_vision.ipynb` — food calorie/macro estimation demo

The food notebook expects `.env` at the repo root and test images in `tests/fixtures/images/`.
