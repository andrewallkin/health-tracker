# Deployment

## Local development

```bash
cp .env.example .env
# Set ENCRYPTION_KEY, JWT_SECRET_KEY, and other required values (see Configuration in the README).

docker compose -f docker-compose.dev.yml up --build
```

In another terminal, apply migrations:

```bash
./backend/run_migrations.sh
```

Open the frontend at **http://localhost:3000** (or the host port from `FRONTEND_PORT`). Optional demo data:

```bash
uv run python scripts/seed_db.py --reset
```

Sign in with `demo@example.com` / `password123`.

## Standalone

Self-contained stack with bundled Postgres—no control panel, shared Docker network, or external TLS termination required.

```bash
cp .env.example .env
# Set ENCRYPTION_KEY, JWT_SECRET_KEY, and other required values.

docker compose -f docker-compose.standalone.yml up --build
```

Apply migrations inside the backend container:

```bash
docker compose -f docker-compose.standalone.yml exec backend bash /app/run_migrations.sh
```

Seed synthetic demo data:

```bash
docker compose -f docker-compose.standalone.yml exec -T backend uv run python scripts/seed_db.py --reset
```

Open **http://localhost:3000**. The API is on **http://127.0.0.1:8000** (loopback only). Put your own reverse proxy and firewall in front of the frontend port before exposing it on a public host.

**Updates:** `docker compose -f docker-compose.standalone.yml up --build -d`

**Logs:** `docker compose -f docker-compose.standalone.yml logs -f`

**Database dump:** `docker compose -f docker-compose.standalone.yml exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql`

**Restore:** `docker compose -f docker-compose.standalone.yml exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < backup.sql`

## This VPS

Production runs from `docker-compose.yml` under the [VPS control panel](https://github.com/andrewallkin/vps-control-panel). The panel:

- Pulls prebuilt images (`andrewallkin/health-tracker`) tagged by its deploy settings
- Writes production `.env` (including `POSTGRES_*` pointing at the shared Postgres instance on external `postgres-net`)
- Runs migrations with `bash /app/run_migrations.sh` in the `backend` container
- Health-checks `http://127.0.0.1:8000/health`

Pushing to `main` runs backend tests and publishes images via [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). The application repository does not contain nginx, TLS, or host port allocation for production.