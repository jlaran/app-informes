#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Prepara la base de datos local para desarrollo:
#   1. genera el cliente Prisma
#   2. crea el esquema (prisma db push)
#   3. aplica RLS + índices trgm
#   4. siembra datos demo (tenant + usuario + avisos de ejemplo)
#   5. (opcional) ingiere el fixture con formato real de edictos
#
# Uso:   ./scripts/setup-local.sh
# Requiere: DATABASE_URL exportada (o usa la de .env por defecto) y `psql`.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:=postgresql://postgres:postgres@localhost:5432/informes?schema=public}"
export DATABASE_URL
echo "→ DATABASE_URL=$DATABASE_URL"

echo "→ (1/5) Construyendo paquetes base (@informes/shared + @informes/db)…"
# Un clon fresco no tiene compilado dist/ de los paquetes del workspace, y el
# seed y la ingesta importan @informes/shared y @informes/db. build:packages
# compila ambos e incluye `prisma generate`.
pnpm build:packages >/dev/null

echo "→ (2/5) Creando esquema (prisma db push)…"
# La base puede tardar unos segundos en aceptar conexiones tras `docker compose up`.
# Reintentamos el push hasta que esté lista (máx ~60s).
for attempt in $(seq 1 20); do
  if pnpm --filter @informes/db exec prisma db push --skip-generate; then
    break
  fi
  if [ "$attempt" -eq 20 ]; then
    echo "✗ No se pudo conectar a la base en $DATABASE_URL. ¿Está corriendo? (docker compose up -d)"
    exit 1
  fi
  echo "   Base no lista todavía, reintentando ($attempt)…"
  sleep 3
done

echo "→ (3/5) Aplicando RLS e índices trigram…"
# psql (libpq) no acepta el parámetro ?schema=... del URL estilo Prisma: lo quitamos.
PSQL_URL="${DATABASE_URL%%\?*}"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/rls.sql >/dev/null
echo "   RLS aplicada."

echo "→ (4/5) Sembrando datos demo…"
pnpm --filter @informes/db seed

echo "→ (5/5) Ingiriendo fixture de boletín (formato real)…"
# La ruta es relativa a apps/ingestion (cwd del filtro pnpm).
pnpm --filter @informes/ingestion exec tsx src/local-run.ts \
  parse src/parser/__fixtures__/boletin-sample.txt 2026-165 || true

echo ""
echo "✅ Base lista. Arranca la app con:  pnpm dev"
echo "   API:  http://localhost:4000/api/health"
echo "   Web:  http://localhost:3000"
