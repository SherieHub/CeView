#!/bin/bash
# Runs once, as the postgres superuser, the first time the container starts
# with an empty /data/pgdata. Creates the unprivileged `ceview` role the apps
# log in with, its database, and the extensions Flyway V1 would otherwise need
# superuser rights to create (its CREATE EXTENSION IF NOT EXISTS becomes a no-op).
set -e

if [ -z "$DB_APP_PASSWORD" ]; then
  echo "DB_APP_PASSWORD is not set" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$DB_APP_PASSWORD" <<'SQL'
CREATE ROLE ceview LOGIN PASSWORD :'app_password';
CREATE DATABASE ceview OWNER ceview;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname ceview <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
