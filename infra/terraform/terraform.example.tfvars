# ---------------------------------------------------------------------------
# Valores de ejemplo para un entorno de desarrollo (dev).
# Copie a terraform.tfvars y ajuste. NO ponga secretos aqui: la contraseña de
# la BD se genera sola y vive en Secrets Manager.
# ---------------------------------------------------------------------------

project     = "informes"
environment = "dev"
aws_region  = "us-east-1"

# --- Red ---
vpc_cidr           = "10.0.0.0/16"
az_count           = 2
single_nat_gateway = true # dev: un solo NAT para abaratar. En prod: false.

# --- Base de datos (Aurora Serverless v2) ---
db_name                = "informes"
db_master_username     = "informes_admin"
db_min_capacity_acu    = 0.5
db_max_capacity_acu    = 4
db_engine_version      = "16.4"
db_deletion_protection = false # dev. En prod: true.

# --- API ---
# Deje api_image vacio para que Terraform cree un ECR; luego haga push de la
# imagen NestJS y actualice el servicio.
api_image          = ""
api_container_port = 4000
api_desired_count  = 2
api_cpu            = 512
api_memory         = 1024
api_min_capacity   = 2
api_max_capacity   = 10
api_cors_origin    = "*" # en prod: el dominio real del frontend.

# --- Ingesta ---
ingestion_image               = ""
ingestion_cpu                 = 1024
ingestion_memory              = 2048
ingestion_schedule_expression = "cron(0 6 * * ? *)" # 06:00 UTC ~ 00:00 CR.

# --- Notificaciones ---
ses_from_email    = "alertas@informes.example.com"
ses_verify_domain = "" # opcional: "informes.example.com" para DKIM.

# --- CDN / Frontend ---
enable_api_behavior     = true
acm_certificate_arn     = "" # ARN de un cert ACM en us-east-1 para dominio propio.
frontend_domain_aliases = [] # p.ej. ["app.informes.example.com"]

# --- Buckets (opcional: se derivan si se dejan vacios) ---
raw_bucket_name       = ""   # -> informes-raw-boletines-dev
frontend_bucket_name  = ""   # -> informes-web-dev
force_destroy_buckets = true # dev: permite terraform destroy con objetos.

# --- Logs ---
log_retention_days = 30
