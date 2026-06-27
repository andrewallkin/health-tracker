FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/

RUN uv sync --project backend --frozen --no-dev

COPY backend ./backend
COPY backend/run_migrations.sh ./run_migrations.sh
RUN chmod +x run_migrations.sh

EXPOSE 8000

CMD ["uv", "run", "--project", "backend", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
