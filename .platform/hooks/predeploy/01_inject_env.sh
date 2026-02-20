#!/bin/bash
# Append EB environment properties to .env so docker-compose variable
# substitution picks them up. EB environment properties are available
# as shell variables in hook context on AL2.
set -e

ENV_FILE=/var/app/staging/.env

cat >> "$ENV_FILE" <<EOF
REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT:-6379}
PGUSER=${PGUSER}
PGHOST=${PGHOST}
PGPASSWORD=${PGPASSWORD}
PGDATABASE=${PGDATABASE}
PGPORT=${PGPORT}
EOF
