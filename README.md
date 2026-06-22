# garmin-api

Personal health and nutrition tooling: Garmin Connect exploration, OpenAI food estimation, and a React nutrition dashboard.

## Project structure

| Folder | Description |
|--------|-------------|
| [`backend/`](backend/) | Food estimation modules (`MacrosEstimator`) — staging for upcoming FastAPI |
| [`frontend/`](frontend/) | Nutrition & health dashboard (Vite + React + TypeScript) |
| [`notebooks/`](notebooks/) | Jupyter notebooks for Garmin API and food vision demos |
| [`scripts/`](scripts/) | Standalone utility scripts (Garmin Connect demo) |
| [`tests/fixtures/`](tests/fixtures/) | Test input images for notebooks and future integration tests |
| [`docs/`](docs/) | Product specs and roadmap |

## Quick start

### Python

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add OPENAI_API_KEY
pytest backend/tests
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Notebooks

Run from the repo root or from `notebooks/`:

- `notebooks/explore.ipynb` — Garmin Connect API exploration
- `notebooks/food_estimate_vision.ipynb` — food calorie/macro estimation demo

The food notebook expects `.env` at the repo root and test images in `tests/fixtures/images/`.
