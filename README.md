# garmin-api

Personal health and nutrition tooling: Garmin Connect exploration, OpenAI food estimation, and a React nutrition dashboard.

## Project structure

| Folder | Description |
|--------|-------------|
| [`backend/`](backend/) | FastAPI app, SQLite persistence, and `MacrosEstimator` |
| [`frontend/`](frontend/) | Nutrition & health dashboard (Vite + React + TypeScript) |
| [`notebooks/`](notebooks/) | Jupyter notebooks for Garmin API and food vision demos |
| [`scripts/`](scripts/) | Utility scripts (Garmin demo, DB seeding) |
| [`tests/fixtures/`](tests/fixtures/) | Test input images for notebooks and integration tests |
| [`docs/`](docs/) | Product specs and roadmap |

## Quick start

### Backend + database

Using [uv](https://docs.astral.sh/uv/) (recommended):

```bash
uv sync
cp .env.example .env
```

Or with pip:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
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
uv run uvicorn backend.main:app --reload --port 8000
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
uv run pytest backend/tests
```

## Notebooks

Run from the repo root or from `notebooks/`:

- `notebooks/explore.ipynb` — Garmin Connect API exploration
- `notebooks/food_estimate_vision.ipynb` — food calorie/macro estimation demo

The food notebook expects `.env` at the repo root and test images in `tests/fixtures/images/`.
