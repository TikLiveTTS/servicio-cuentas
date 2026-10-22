#!/usr/bin/env bash
# Arranca servicio-cuentas contra un Postgres LOCAL propio (base + rol
# dedicados, aislados de cualquier otra DB de este Postgres), para tocar lo
# que quieras sin tocar producción (Supabase self-hosted).
#
# Usa el Postgres nativo que ya corre en el sistema (puerto 5432). Crea, si
# no existen, el rol y la base "servicio_cuentas_local". La API migra sola
# al arrancar (mismo esquema "cuentas" que producción).
#
# Uso:
#   ./scripts/dev-local.sh          # crea (si falta) la DB local y arranca la API
#   ./scripts/dev-local.sh reset    # dropea la DB local y la vuelve a crear vacía

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

PG_SUPERUSER_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"
DB_NAME="servicio_cuentas_local"
DB_ROLE="servicio_cuentas_local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[dev-local] generando $ENV_FILE con credenciales/secretos random..."
  DB_PASSWORD="$(openssl rand -hex 16)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<EOF
POSTGRES_URL=postgresql://$DB_ROLE:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME
DB_SCHEMA=cuentas
SESSION_SECRET=$SESSION_SECRET
PORT=4000
SESSION_HOURS=720
TRUST_PROXY=0
PUBLIC_ORIGIN=*
RECONCILE_EVERY_HOURS=6
PUBLIC_URL=http://localhost:4000
# credencial interna, solo para que este script sepa recrear el rol en "reset"
DB_PASSWORD_LOCAL=$DB_PASSWORD
EOF
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [[ "${1:-}" == "reset" ]]; then
  echo "[dev-local] dropeando $DB_NAME..."
  PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS $DB_NAME;"
fi

DB_EXISTS=$(PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

if [[ "$DB_EXISTS" != "1" ]]; then
  echo "[dev-local] creando rol y base de datos local ($DB_NAME)..."
  ROLE_EXISTS=$(PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname='$DB_ROLE'")
  if [[ "$ROLE_EXISTS" != "1" ]]; then
    PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE ROLE $DB_ROLE LOGIN PASSWORD '$DB_PASSWORD_LOCAL';"
  fi
  PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE $DB_NAME OWNER $DB_ROLE;"
fi

if [[ ! -d "$ROOT_DIR/api/node_modules" ]]; then
  echo "[dev-local] instalando dependencias de api/..."
  (cd "$ROOT_DIR/api" && npm install)
fi

echo "[dev-local] arrancando la API en :4000 (DB: $DB_NAME, migra sola al conectar)..."
cd "$ROOT_DIR/api"
echo $$ > /tmp/servicio-cuentas-local.pid
exec node src/index.js
