#!/usr/bin/env bash
#
# One-time local setup for the Near Insanity PostgreSQL database.
#
# Creates the role and database that config/settings.py expects by default
# (DB_USER=nearinsanity, DB_PASSWORD=nearinsanity_dev, DB_NAME=nearinsanity).
#
# Works with a local Postgres install (e.g. Homebrew: `brew services start
# postgresql@17`). Requires being able to connect to the `postgres` database
# as a superuser (Homebrew's default superuser is your macOS username with
# no password).
#
# Alternatively, skip this and use `docker-compose -f docker-compose.db.yml
# up -d` to run a postgres:15 container that matches production.
#
set -euo pipefail

DB_USER="${DB_USER:-nearinsanity}"
DB_PASSWORD="${DB_PASSWORD:-nearinsanity_dev}"
DB_NAME="${DB_NAME:-nearinsanity}"

psql -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}' CREATEDB;
  END IF;
END
\$\$;
SQL

# Allow the role to create databases (needed by `manage.py test`).
psql -d postgres -c "ALTER ROLE ${DB_USER} CREATEDB;" >/dev/null

if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  psql -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

echo "Database '${DB_NAME}' and role '${DB_USER}' are ready."
echo "Next: cd backend && .venv/bin/python manage.py migrate"