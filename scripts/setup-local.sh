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

echo "→ (1/5) Generando cliente Prisma…"
pnpm --filter @informes/db exec prisma generate >/dev/null

echo "→ (2/5) Creando esquema (prisma db push)…"
pnpm --filter @informes/db exec prisma db push --skip-generate

echo "→ (3/5) Aplicando RLS e índices trigram…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/rls.sql >/dev/null
echo "   RLS aplicada."

echo "→ (4/5) Sembrando datos demo…"
pnpm --filter @informes/db seed

echo "→ (5/5) Ingiriendo fixture de boletín (formato real)…"
pnpm --filter @informes/ingestion exec tsx src/local-run.ts \
  parse apps/ingestion/src/parser/__fixtures__/boletin-sample.txt 2026-165 || true

echo ""
echo "✅ Base lista. Arranca la app con:  pnpm dev"
echo "   API:  http://localhost:4000/api/health"
echo "   Web:  http://localhost:3000"
