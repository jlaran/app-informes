# app-informes — Plataforma de Boletines Judiciales (Costa Rica)

Plataforma **multi-tenant**, **escalable** y **optimizada para AWS** que extrae,
estructura y expone la información publicada en los **Boletines Judiciales del
Poder Judicial de Costa Rica** (fuente: [Nexus PJ](https://nexuspj.poder-judicial.go.cr)),
segmentada en cuatro secciones y con un motor de alertas configurable.

## Secciones

1. **Remates de Propiedades** — casas, fincas, lotes, edificios.
2. **Remates de Vehículos**.
3. **Personas Fallecidas** — procesos sucesorios.
4. **Sociedades Disueltas**.

Y una sección de **Alertas** donde el usuario define condiciones:

| Sección | Condiciones de alerta |
|---------|-----------------------|
| Remates de propiedades | ubicación, precio, área |
| Remates de vehículos | precio, marca, año |
| Personas fallecidas | cédula, nombre |
| Sociedades disueltas | cédula jurídica, nombre |

## Arquitectura

Ver **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** (diagrama, componentes AWS,
estrategia multi-tenant) y **[docs/DATA_MODEL.md](docs/DATA_MODEL.md)** (modelo de
datos y formas de los criterios de alerta).

Idea central de tenancy: los boletines son **datos públicos compartidos** (se
ingieren una sola vez); lo aislado por tenant son usuarios, alertas y
coincidencias (Row-Level Security de PostgreSQL).

## Estructura del monorepo

```
apps/
  api/          NestJS  — API REST (secciones públicas + alertas tenant-scoped)
  web/          Next.js — frontend (App Router, Tailwind)
  ingestion/    Workers — downloader + parser + clasificador + motor de alertas
packages/
  shared/       @informes/shared — enums, criterios (Zod), normalización
  db/           @informes/db — esquema Prisma, cliente, RLS, seed
infra/
  terraform/    IaC AWS — VPC, Aurora, S3, SQS, ECS, Cognito, CloudFront, SES/SNS
docs/           Arquitectura y modelo de datos
```

## Stack

- **Lenguaje:** TypeScript (ESM) en todo el monorepo.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Backend:** NestJS 10.
- **Frontend:** Next.js 14 (App Router) + Tailwind.
- **Datos:** Aurora PostgreSQL Serverless v2 + Prisma (RLS, `pg_trgm`).
- **Ingesta:** Node workers en Fargate/Lambda, AWS Textract para OCR.
- **Auth:** Amazon Cognito (claim `custom:tenant_id`).
- **IaC:** Terraform.

## Puesta en marcha (desarrollo) — 3 pasos

Requisitos: **Node 20+**, **pnpm 9+**, y **Docker** (para la base de datos; o un
PostgreSQL 16 propio).

```bash
# 1. Instalar dependencias y base de datos
pnpm install
cp .env.example .env          # los valores por defecto ya apuntan al Docker
docker compose up -d          # PostgreSQL en localhost:5432 (db "informes")

# 2. Preparar la base (esquema + RLS + datos demo + fixture de ejemplo)
pnpm db:setup

# 3. Levantar API + Web juntos
pnpm dev
#   API →  http://localhost:4000/api/health
#   Web →  http://localhost:3000
```

`pnpm db:setup` corre `scripts/setup-local.sh`: `prisma db push`, aplica RLS e
índices trigram, siembra un tenant demo y **ingiere un boletín de ejemplo con
formato real**, así la app arranca con datos en las cuatro secciones.

Sin PostgreSQL propio ni Docker, use cualquier Postgres 16 y ajuste
`DATABASE_URL` en `.env`.

> El `.env` se carga automáticamente (la API y los workers lo buscan hacia
> arriba en el monorepo). Para probar sin Cognito, la web usa cabeceras demo
> (`x-demo-tenant`) contra la API en desarrollo (ver `apps/web/src/lib/api.ts` y
> `TenantMiddleware`).

## Ingesta (local)

```bash
# Parsear un PDF o TXT de boletín y evaluar alertas
pnpm --filter @informes/ingestion parse ./ruta/al/boletin.pdf 2026-165
```

> ⚠️ El adaptador de Nexus PJ / Boletín Judicial
> (`apps/ingestion/src/sources/nexus-pj.adapter.ts`) tiene marcados con
> `TODO(nexus)` los detalles del endpoint/descarga que deben confirmarse desde
> dentro de la VPC de AWS (la fuente `boletinjudicial.poder-judicial.go.cr` /
> `nexuspj.poder-judicial.go.cr` solo es alcanzable desde redes de CR).

## Demo end-to-end (slice vertical validado)

El pipeline completo (parseo → BD → API → alertas) se puede correr localmente
contra un PostgreSQL real usando un **fixture con el formato real** de los
edictos (`apps/ingestion/src/parser/__fixtures__/boletin-sample.txt`):

```bash
export DATABASE_URL=postgresql://postgres@localhost:5432/informes

# esquema + RLS + datos base
pnpm --filter @informes/db exec prisma db push
psql "$DATABASE_URL" -f packages/db/prisma/rls.sql
pnpm --filter @informes/db seed

# 1) ingerir un boletín (fixture con formato real de edictos)
pnpm --filter @informes/ingestion parse \
  apps/ingestion/src/parser/__fixtures__/boletin-sample.txt 2026-165

# 2) API arriba, crear una alerta (tenant-scoped, RLS)
pnpm --filter @informes/api start &
curl -X POST localhost:4000/api/alerts \
  -H 'content-type: application/json' -H "x-demo-tenant: <TENANT_ID>" \
  -d '{"name":"Casas SJ <=60M","category":"PROPERTY_AUCTION",
       "criteria":{"location":{"provincia":"San José"},"price":{"max":60000000}}}'

# 3) evaluar alertas contra los avisos
pnpm --filter @informes/ingestion exec tsx src/local-run.ts match-all

# 4) consultar coincidencias
curl localhost:4000/api/alerts/matches -H "x-demo-tenant: <TENANT_ID>"
```

Verificado: los extractores parsean remates (inmueble/vehículo, ¢/$),
sucesorios (nombre + cédula) y disoluciones (razón social + cédula jurídica);
la RLS aísla alertas y coincidencias por tenant; el matcher respeta
ubicación/precio/área y cédula/nombre. Cobertura en
`apps/ingestion/src/parser/parser.test.ts`.

## Infraestructura

```bash
cd infra/terraform
terraform init
terraform plan  -var-file=terraform.example.tfvars
terraform apply -var-file=terraform.example.tfvars
```

Ver `infra/terraform/README.md` para prerequisitos y orden de despliegue.

## Estado

Fundación completa del monorepo: modelo de datos, tipos compartidos, API,
frontend, workers de ingesta e IaC. Los extractores del parser y el adaptador de
la fuente son heurísticos y están marcados para afinarse con boletines reales.
