# garmin-api

Personal health and nutrition tooling: Garmin Connect exploration, OpenAI food estimation, and a React nutrition dashboard.

## Project structure

| Folder | Description |
|--------|-------------|
| [`backend/`](backend/) | FastAPI app, SQLite persistence, and `MacrosEstimator` (`backend/pyproject.toml`) |
| [`frontend/`](frontend/) | Nutrition & health dashboard (Vite + React + TypeScript) |
| [`notebooks/`](notebooks/) | Jupyter notebooks for Garmin API and food vision demos |
| [`scripts/`](scripts/) | Utility scripts (Garmin demo, DB seeding) |
| [`tests/fixtures/`](tests/fixtures/) | Test input images for notebooks and integration tests |
| [`docs/`](docs/) | Product specs and roadmap |

## Quick start

### Backend + database

Using [uv](https://docs.astral.sh/uv/):

```bash
# Root: scripts, notebooks, and backend deps (uv workspace)
uv sync --all-packages --all-groups
cp .env.example .env
```

Backend-only sync (same deps a future Docker image will use):

```bash
uv sync --project backend --all-groups
```

Generate an encryption key and add it to `.env`:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Seed the SQLite database with dummy nutrition data:

```bash
uv run python scripts/seed_db.py --reset
```

Run the API (from repo root):

```bash
uv run --project backend uvicorn backend.main:app --reload --port 8000
```

Add your OpenAI API key and model choices in the app **Settings** screen (stored encrypted in SQLite).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend on port 8000.

### Tests

```bash
uv run --project backend pytest
```

## Notebooks

Install the Jupyter kernel once (uses the root project env):

```bash
uv run python -m ipykernel install --user --name health-tracker --display-name "Health Tracker"
```

Run from the repo root or from `notebooks/`:

- `notebooks/explore.ipynb` — Garmin Connect API exploration
- `notebooks/food_estimate_vision.ipynb` — food calorie/macro estimation demo

The food notebook expects `.env` at the repo root and test images in `tests/fixtures/images/`.
