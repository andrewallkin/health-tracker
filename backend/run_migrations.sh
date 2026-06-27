#!/bin/bash
set -e

echo "==================================="
echo "Database Migration Script"
echo "==================================="

echo "Waiting for database to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if uv run --project backend alembic -c backend/alembic.ini current &>/dev/null; then
        echo "✓ Database is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "Attempt $attempt/$max_attempts: Database not ready yet, waiting..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "✗ Database failed to become ready after $max_attempts attempts"
    exit 1
fi

echo ""
echo "Current database version:"
uv run --project backend alembic -c backend/alembic.ini current

echo ""
echo "Running migrations..."
uv run --project backend alembic -c backend/alembic.ini upgrade head

echo ""
echo "Migration completed successfully!"
echo "Current database version:"
uv run --project backend alembic -c backend/alembic.ini current

echo "==================================="
