# Arquitectura — Plataforma de Boletines Judiciales (Costa Rica)

## 1. Objetivo

Plataforma **multi-tenant**, **escalable** y **optimizada para AWS** que extrae,
estructura y expone la información publicada en los **Boletines Judiciales del
Poder Judicial de Costa Rica**, segmentada en cuatro dominios y con un motor de
alertas configurable por el usuario.

Segmentos:

1. **Remates judiciales — Propiedades** (casas, fincas, lotes, edificios)
2. **Remates judiciales — Vehículos**
3. **Personas fallecidas** (procesos sucesorios)
4. **Sociedades disueltas**

## 2. Principio central de multi-tenancy

> Los boletines son **información pública compartida**. Los datos privados de
> cada tenant son sus **usuarios, alertas, coincidencias y facturación**.

Esto separa el sistema en dos planos:

| Plano | Contenido | Tenancy | Escala |
|-------|-----------|---------|--------|
| **Datos públicos** | Boletines, avisos, remates, fallecidos, sociedades | Global (sin `tenant_id`) | Se ingiere una vez, se lee muchas veces |
| **Datos de tenant** | Tenants, usuarios, alertas, coincidencias, guardados | Aislado por `tenant_id` + RLS | Crece con la base de clientes |

Ventajas: se ingiere y parsea **una sola vez** para todos los clientes; el costo
de ingesta no escala con el número de tenants; las consultas al dataset público
se cachean agresivamente (CloudFront / capa de lectura).

### Estrategia de aislamiento

- **Modelo:** *shared database, shared schema* con **Row-Level Security (RLS)**
  de PostgreSQL sobre las tablas de tenant.
- Cada request autenticado resuelve un `tenant_id` desde el claim de Cognito y
  lo fija en la sesión de base de datos: `SET LOCAL app.current_tenant = '<uuid>'`.
- Las políticas RLS filtran por `tenant_id = current_setting('app.current_tenant')::uuid`.
- El rol de aplicación de la base de datos **no** tiene `BYPASSRLS`.
- Defensa en profundidad: la capa de aplicación (NestJS) también filtra por
  `tenant_id` mediante un `TenantContext` (AsyncLocalStorage) + extensión de
  Prisma. Ver `apps/api/src/common/tenant`.

## 3. Diagrama lógico

```
                       ┌───────────────────────────────────────────────┐
                       │                   Fuente                        │
                       │   Nexus PJ (nexuspj.poder-judicial.go.cr)       │
                       └───────────────────────┬─────────────────────────┘
                                               │ (scrape/descarga PDF)
        EventBridge (cron diario)              ▼
        ─────────────────────────►   ┌──────────────────────┐
                                      │  Ingestion Worker     │  apps/ingestion
                                      │  (Fargate / Lambda)   │
                                      └──────────┬───────────┘
                                                 │ PDF crudo
                                                 ▼
                                      ┌──────────────────────┐
                                      │   S3 (raw-boletines)  │
                                      └──────────┬───────────┘
                                     evento S3   │
                                                 ▼
                                      ┌──────────────────────┐   Textract
                                      │      SQS (parse)      │◄──(si escaneado)
                                      └──────────┬───────────┘
                                                 ▼
                                      ┌──────────────────────┐
                                      │   Parser + Classifier │  apps/ingestion
                                      │  (Fargate / Lambda)   │
                                      └──────────┬───────────┘
                                                 │ avisos estructurados
                                                 ▼
   ┌───────────────┐   RLS      ┌──────────────────────────────────────┐
   │   Cognito     │◄──────────►│   Aurora PostgreSQL Serverless v2     │
   │ (user pools)  │            │   (datos públicos + datos de tenant)  │
   └──────┬────────┘            └───────┬───────────────────┬───────────┘
          │                             │                   │
          │                    ┌────────▼────────┐   ┌──────▼───────────┐
          │                    │   API (NestJS)  │   │  Alert Matcher    │  apps/ingestion
          │                    │  ECS Fargate +  │   │  (Fargate/Lambda) │
          │                    │  ALB / API GW   │   └──────┬───────────┘
          │                    └────────┬────────┘          │ coincidencias
          ▼                             │                   ▼
   ┌───────────────┐          ┌─────────▼────────┐   ┌──────────────────┐
   │ Web (Next.js) │◄────────►│   CloudFront     │   │   SES / SNS       │
   │ CloudFront+S3 │          └──────────────────┘   │  (email / push)   │
   └───────────────┘                                 └──────────────────┘
```

## 4. Componentes

### 4.1 Ingesta (`apps/ingestion`)
- **Downloader:** consulta Nexus PJ con la query `tipoInformacion:(Boletín AND
  Judicial)`, pagina resultados, descarga cada edición en PDF y la sube a S3
  (`raw-boletines/<año>/<numero>.pdf`). Registra la edición en la tabla
  `boletines`. Diseñado con patrón **adaptador de fuente** (`SourceAdapter`)
  para poder cambiar de fuente sin tocar el resto.
- **Parser:** extrae texto (nativo con `pdf-parse`; si el PDF es escaneado,
  cae a **AWS Textract**). Segmenta el documento en avisos individuales.
- **Classifier:** clasifica cada aviso en una de las 4 categorías por
  heurísticas de encabezado/palabras clave (remate de bien inmueble vs.
  vehículo, sucesorio, disolución) y extrae los campos estructurados.
- **Alert Matcher:** ante avisos nuevos, evalúa las reglas de alerta activas y
  produce coincidencias + notificaciones.

> **Idempotencia:** cada boletín se identifica por número/fecha; cada aviso por
> un hash estable de (boletín + expediente + texto). Reprocesar un boletín no
> duplica avisos (upsert por hash).

### 4.2 API (`apps/api`) — NestJS
- Módulos: `auctions` (propiedades + vehículos), `deceased`, `dissolutions`,
  `alerts`, `tenants`, `auth`, `notices`.
- Autenticación por JWT de Cognito; `TenantGuard` + `TenantContext` fijan la
  tenancy por request.
- Endpoints de lectura pública (dataset) cacheables; endpoints de alertas y
  perfil, tenant-scoped.

### 4.3 Web (`apps/web`) — Next.js (App Router)
- Vistas por segmento con filtros (ubicación, precio, área / cédula / nombre).
- Gestor de alertas.
- Servido vía CloudFront + S3 (export estático o SSR en Lambda@Edge/Fargate).

### 4.4 Datos — Aurora PostgreSQL Serverless v2
- Extensiones: `pg_trgm` (búsqueda difusa de nombres/cédulas), `unaccent`,
  `uuid-ossp`. `citext` para emails.
- Escala de cómputo automática; réplicas de lectura para el dataset público.

## 5. Escalabilidad

- **Cómputo sin estado** (API y workers) → autoscaling horizontal en ECS/Lambda.
- **Ingesta desacoplada por colas** (SQS) → absorbe picos y permite reintentos
  con *dead-letter queue*.
- **Lectura del dataset público** cacheada en CloudFront y replicable con
  réplicas de lectura de Aurora.
- **Aurora Serverless v2** escala capacidad según carga; la separación
  público/tenant evita que la ingesta compita con las consultas de usuarios.
- **Búsqueda:** para volúmenes grandes se puede promover el texto a OpenSearch;
  el modelo deja el `raw_text` disponible para indexar.

## 6. Seguridad

- Cognito user pools con `tenant_id` como *custom attribute* / claim.
- RLS como frontera dura de aislamiento entre tenants.
- Secretos en Secrets Manager; configuración en SSM Parameter Store.
- Buckets S3 privados; acceso a la web solo vía OAC de CloudFront.
- Principio de menor privilegio en roles IAM por servicio.

## 7. Estructura del monorepo

```
app-informes/
├── apps/
│   ├── api/          # NestJS API
│   ├── web/          # Next.js frontend
│   └── ingestion/    # Downloader + Parser + Classifier + Alert Matcher
├── packages/
│   ├── shared/       # Tipos, enums y contratos compartidos (@informes/shared)
│   └── db/           # Prisma schema, cliente y migraciones (@informes/db)
├── infra/
│   └── terraform/    # IaC: VPC, Aurora, S3, SQS, ECS, Cognito, CloudFront, SES
└── docs/
```

## 8. Decisiones pendientes de validar

1. **Endpoint/selectores reales de Nexus PJ** — el dominio se accede desde CR;
   validar la forma exacta de descarga desde dentro de la VPC.
2. **Frecuencia de publicación** del Boletín Judicial (¿diaria hábil?) para
   afinar el cron de EventBridge.
3. **Cobertura histórica** — ¿desde qué fecha se ingiere el histórico?
4. **Textract vs. OCR propio** según proporción de boletines escaneados.
