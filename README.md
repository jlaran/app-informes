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

## Puesta en marcha (desarrollo)

Requisitos: Node 20+, pnpm 9+, PostgreSQL local (o Docker).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar entorno
cp .env.example .env        # y editar DATABASE_URL, etc.

# 3. Base de datos: generar cliente, migrar y aplicar RLS
pnpm db:generate
pnpm db:migrate             # crea el esquema
psql "$DATABASE_URL" -f packages/db/prisma/rls.sql   # políticas RLS + índices trgm
pnpm db:seed               # datos de demo (tenant + avisos de ejemplo)

# 4. Levantar API y Web
pnpm --filter @informes/api dev     # http://localhost:4000/api
pnpm --filter @informes/web dev     # http://localhost:3000
```

Para probar sin Cognito, la web usa cabeceras demo (`x-demo-tenant`) contra la
API en desarrollo (ver `apps/web/src/lib/api.ts` y `TenantMiddleware`).

## Ingesta (local)

```bash
# Parsear un PDF o TXT de boletín y evaluar alertas
pnpm --filter @informes/ingestion parse ./ruta/al/boletin.pdf 2026-165
```

> ⚠️ El adaptador de Nexus PJ (`apps/ingestion/src/sources/nexus-pj.adapter.ts`)
> tiene marcados con `TODO(nexus)` los detalles del endpoint/descarga que deben
> confirmarse desde dentro de la VPC de AWS (la fuente solo es alcanzable desde
> redes de CR).

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
