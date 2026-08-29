# Infraestructura como código — app-informes (Terraform / AWS)

IaC del backend de la **Plataforma de Boletines Judiciales (Costa Rica)**:
multi-tenant, escalable y optimizada para AWS. Sigue la arquitectura descrita en
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) y el modelo de
[`docs/DATA_MODEL.md`](../../docs/DATA_MODEL.md).

## Qué crea

| Módulo | Recursos principales |
|--------|----------------------|
| `networking` | VPC, subnets públicas/privadas en 2 AZ, IGW, NAT gateway(s), route tables, VPC endpoint S3, security groups base (ALB / API / workers) |
| `database` | Aurora PostgreSQL **Serverless v2** (cluster + 1 instancia `db.serverless`), subnet group privado, SG, credenciales en **Secrets Manager** (`random_password`), cluster parameter group con `rds.force_ssl` |
| `storage` | Bucket S3 privado de PDFs crudos (versionado, SSE, block public access, lifecycle IA/Glacier), notificación **S3 → SQS(parse)** |
| `queues` | SQS `parse` + DLQ y `alerts` + DLQ (redrive policy, SSE) |
| `auth` | Cognito User Pool + Client, atributo custom `tenant_id` (y `role`) |
| `notifications` | SNS topic de alertas + identidades SES (email y dominio opcional) |
| `compute_api` | ECS **Fargate** (cluster, task def, service), **ALB** + target group + listener, autoscaling target-tracking CPU, IAM (exec/task) de menor privilegio, log group, ECR opcional |
| `ingestion` | EventBridge cron → **RunTask** (downloader), servicios Fargate **parser** (long-poll SQS, autoscaling por profundidad de cola) y **alert matcher**, IAM (S3/SQS/Textract/Secret/SNS/SES), log group, ECR opcional |
| `cdn` | Bucket S3 privado del frontend + **CloudFront** con **OAC**, comportamiento `/api/*` → ALB, `index.html` como root, respuestas SPA |

## Prerrequisitos

- **Terraform >= 1.7** y **AWS provider ~> 5.0**.
- Credenciales AWS con permisos para crear los recursos (ver
  [AWS CLI config](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)).
- (Opcional) Certificado **ACM en us-east-1** si se usará dominio propio en
  CloudFront (`acm_certificate_arn`).

## Inicializar / planificar / aplicar

```bash
cd infra/terraform

# 1. Copie el ejemplo de variables y ajuste
cp terraform.example.tfvars terraform.tfvars
$EDITOR terraform.tfvars

# 2. Inicialice
terraform init

# 3. Revise el plan
terraform plan -var-file=terraform.tfvars

# 4. Aplique
terraform apply -var-file=terraform.tfvars
```

## Backend remoto del state (recomendado)

El state por defecto es local. Para trabajo en equipo use un backend S3. El
bucket (y opcionalmente la tabla de bloqueo) deben existir **antes** de
inicializar el backend:

```bash
# Bucket de state (nombre único global)
aws s3api create-bucket --bucket informes-tfstate-<account-id> --region us-east-1
aws s3api put-bucket-versioning --bucket informes-tfstate-<account-id> \
  --versioning-configuration Status=Enabled
```

Luego descomente el bloque `backend "s3"` en [`backend.tf`](./backend.tf) y
migre el state:

```bash
terraform init -migrate-state
```

- Terraform **>= 1.10** soporta bloqueo nativo en S3 con `use_lockfile = true`
  (ya presente en el ejemplo).
- Para versiones anteriores use `dynamodb_table = "..."` con una tabla que tenga
  clave primaria `LockID` (String).

## Después de `apply`

Los recursos de cómputo arrancan con una imagen *placeholder* si no se pasó
`api_image` / `ingestion_image`. Para desplegar el código real:

```bash
# URLs de los repos ECR creados
terraform output api_ecr_repository_url
terraform output ingestion_ecr_repository_url

# Build + push (ejemplo API)
API_ECR=$(terraform output -raw api_ecr_repository_url)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "${API_ECR%/*}"
docker build -t "$API_ECR:latest" ../../apps/api
docker push "$API_ECR:latest"

# Fuerce un nuevo despliegue del servicio
aws ecs update-service --cluster $(terraform output -raw api_cluster_name) \
  --service informes-dev-api --force-new-deployment
```

Frontend (Next.js export estático):

```bash
aws s3 sync ../../apps/web/out "s3://$(terraform output -raw frontend_bucket_name)/" --delete
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) --paths '/*'
```

## Variables de entorno para la app

Los outputs mapean directamente a `.env.example`:

| Output | Variable de la app |
|--------|--------------------|
| `s3_raw_boletines_bucket` | `S3_RAW_BOLETINES_BUCKET` |
| `sqs_parse_queue_url` | `SQS_PARSE_QUEUE_URL` |
| `sqs_alerts_queue_url` | `SQS_ALERTS_QUEUE_URL` |
| `cognito_user_pool_id` | `COGNITO_USER_POOL_ID` |
| `cognito_client_id` | `COGNITO_CLIENT_ID` |
| `sns_alerts_topic_arn` | `SNS_ALERTS_TOPIC_ARN` |
| `ses_from_email` | `SES_FROM_EMAIL` |
| `db_secret_arn` | credenciales para `DATABASE_URL` (leer el secreto JSON) |

## Base de datos: rol de aplicación y RLS

El cluster se crea con el usuario **maestro** (`db_master_username`). La RLS del
diseño exige un rol de aplicación **sin `BYPASSRLS`** (`informes_app`). Ese rol,
las extensiones (`pg_trgm`, `unaccent`, `uuid-ossp`, `citext`) y las políticas
RLS se crean por **migraciones** (`packages/db`), no por Terraform:

```sql
CREATE ROLE informes_app LOGIN PASSWORD '...';   -- sin BYPASSRLS
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
```

## Notas de seguridad

- Buckets S3 privados con *block public access* total; el frontend solo se sirve
  vía **OAC** de CloudFront; se fuerza TLS.
- La BD solo acepta conexiones desde los SG de la API y de los workers.
- Secretos en **Secrets Manager** (nunca en texto plano ni en variables).
- IAM de **menor privilegio** por servicio (roles separados API / ingesta /
  EventBridge).
- SES parte en *sandbox*: verifique la identidad y solicite salida de sandbox
  para enviar a destinatarios arbitrarios en producción.

## Costo / entornos

- `single_nat_gateway = true` y capacidad Aurora baja abaratan **dev**. En
  **prod** use `single_nat_gateway = false` (un NAT por AZ), `db_deletion_protection = true`
  y suba `db_max_capacity_acu` / `api_max_capacity`.

## Nota

**No** ejecute `terraform apply` sin revisar el `plan`. Este código no se ha
aplicado; requiere credenciales y red reales.
