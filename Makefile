.PHONY: help dev-up dev-down dev-build dev-logs dev-shell migrate migrate-create migrate-history migrate-rollback prod-up prod-down clean

help:
	@echo "Health Tracker - Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev-up          - Start dev stack with Postgres"
	@echo "  make dev-build       - Rebuild and start dev stack"
	@echo "  make dev-down        - Stop development environment"
	@echo "  make dev-logs        - View development logs"
	@echo "  make dev-shell       - Open shell in backend container"
	@echo ""
	@echo "Database Migrations:"
	@echo "  make migrate         - Run pending migrations"
	@echo "  make migrate-create  - Create new migration (use MSG='description')"
	@echo "  make migrate-history - Show migration history"
	@echo "  make migrate-rollback - Rollback last migration"
	@echo ""
	@echo "Production (no Postgres service):"
	@echo "  make prod-up         - Start production compose"
	@echo "  make prod-down       - Stop production compose"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean           - Remove dev containers and volumes"

dev-up:
	docker compose -f docker-compose.dev.yml up -d
	@echo "Development environment started."
	@echo "  Backend:  http://localhost:$${BACKEND_PORT:-8000}"
	@echo "  Frontend: http://localhost:$${FRONTEND_PORT:-3000}"
	@echo "  Postgres: localhost:$${POSTGRES_PORT:-5432}"

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-build:
	docker compose -f docker-compose.dev.yml up -d --build

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

dev-shell:
	docker compose -f docker-compose.dev.yml exec backend bash

migrate:
	docker compose -f docker-compose.dev.yml exec backend ./run_migrations.sh

migrate-create:
ifndef MSG
	@echo "Error: Please provide a message: make migrate-create MSG='description'"
	@exit 1
endif
	docker compose -f docker-compose.dev.yml exec backend uv run --project backend alembic -c backend/alembic.ini revision --autogenerate -m "$(MSG)"

migrate-history:
	docker compose -f docker-compose.dev.yml exec backend uv run --project backend alembic -c backend/alembic.ini history

migrate-rollback:
	docker compose -f docker-compose.dev.yml exec backend uv run --project backend alembic -c backend/alembic.ini downgrade -1

prod-up:
	docker compose up -d

prod-down:
	docker compose down

clean:
	docker compose -f docker-compose.dev.yml down -v
	docker system prune -af
