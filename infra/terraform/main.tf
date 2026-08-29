# ---------------------------------------------------------------------------
# Composicion raiz: instancia todos los modulos y conecta sus outputs.
# Orden logico de dependencias (Terraform lo resuelve solo via referencias):
#   networking, queues, auth, notifications  ->  storage, database  ->
#   compute_api, ingestion  ->  cdn.
# ---------------------------------------------------------------------------

locals {
  name_prefix = "${var.project}-${var.environment}"

  # Nombres de bucket: derivados si no se especifican explicitamente.
  raw_bucket_name      = var.raw_bucket_name != "" ? var.raw_bucket_name : "${var.project}-raw-boletines-${var.environment}"
  frontend_bucket_name = var.frontend_bucket_name != "" ? var.frontend_bucket_name : "${var.project}-web-${var.environment}"
}

# ---- Red -----------------------------------------------------------------
module "networking" {
  source = "./modules/networking"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  az_count           = var.az_count
  single_nat_gateway = var.single_nat_gateway
}

# ---- Colas ----------------------------------------------------------------
module "queues" {
  source = "./modules/queues"

  name_prefix = local.name_prefix
}

# ---- Almacenamiento (S3 PDFs crudos + notificacion a la cola de parsing) ---
module "storage" {
  source = "./modules/storage"

  name_prefix     = local.name_prefix
  bucket_name     = local.raw_bucket_name
  parse_queue_arn = module.queues.parse_queue_arn
  parse_queue_id  = module.queues.parse_queue_url
  force_destroy   = var.force_destroy_buckets
}

# ---- Base de datos --------------------------------------------------------
module "database" {
  source = "./modules/database"

  name_prefix        = local.name_prefix
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  # Menor privilegio: solo la API y los workers pueden alcanzar la BD.
  allowed_security_group_ids = [
    module.networking.api_security_group_id,
    module.networking.workers_security_group_id
  ]

  db_name             = var.db_name
  master_username     = var.db_master_username
  engine_version      = var.db_engine_version
  min_capacity_acu    = var.db_min_capacity_acu
  max_capacity_acu    = var.db_max_capacity_acu
  deletion_protection = var.db_deletion_protection
}

# ---- Autenticacion (Cognito) ----------------------------------------------
module "auth" {
  source = "./modules/auth"

  name_prefix = local.name_prefix
}

# ---- Notificaciones (SNS + SES) -------------------------------------------
module "notifications" {
  source = "./modules/notifications"

  name_prefix       = local.name_prefix
  ses_from_email    = var.ses_from_email
  ses_verify_domain = var.ses_verify_domain
}

# ---- API (ECS Fargate + ALB) ----------------------------------------------
module "compute_api" {
  source = "./modules/compute_api"

  name_prefix = local.name_prefix
  aws_region  = var.aws_region

  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  private_subnet_ids    = module.networking.private_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  api_security_group_id = module.networking.api_security_group_id

  container_image    = var.api_image
  container_port     = var.api_container_port
  desired_count      = var.api_desired_count
  cpu                = var.api_cpu
  memory             = var.api_memory
  min_capacity       = var.api_min_capacity
  max_capacity       = var.api_max_capacity
  log_retention_days = var.log_retention_days
  cors_origin        = var.api_cors_origin

  db_secret_arn        = module.database.secret_arn
  sns_alerts_topic_arn = module.notifications.alerts_topic_arn
  alerts_queue_arn     = module.queues.alerts_queue_arn
  alerts_queue_url     = module.queues.alerts_queue_url
  parse_queue_url      = module.queues.parse_queue_url
  raw_bucket_arn       = module.storage.bucket_arn
  raw_bucket_name      = module.storage.bucket_name
  cognito_user_pool_id = module.auth.user_pool_id
  cognito_client_id    = module.auth.client_id
  ses_from_email       = module.notifications.ses_from_email
}

# ---- Ingesta / parsing / alert matcher ------------------------------------
module "ingestion" {
  source = "./modules/ingestion"

  name_prefix = local.name_prefix
  aws_region  = var.aws_region

  private_subnet_ids        = module.networking.private_subnet_ids
  workers_security_group_id = module.networking.workers_security_group_id

  container_image     = var.ingestion_image
  cpu                 = var.ingestion_cpu
  memory              = var.ingestion_memory
  schedule_expression = var.ingestion_schedule_expression
  log_retention_days  = var.log_retention_days

  db_secret_arn        = module.database.secret_arn
  raw_bucket_arn       = module.storage.bucket_arn
  raw_bucket_name      = module.storage.bucket_name
  parse_queue_arn      = module.queues.parse_queue_arn
  parse_queue_url      = module.queues.parse_queue_url
  parse_queue_name     = "${local.name_prefix}-parse"
  alerts_queue_arn     = module.queues.alerts_queue_arn
  alerts_queue_url     = module.queues.alerts_queue_url
  sns_alerts_topic_arn = module.notifications.alerts_topic_arn
  ses_from_email       = module.notifications.ses_from_email
}

# ---- CDN (frontend Next.js + CloudFront) ----------------------------------
module "cdn" {
  source = "./modules/cdn"

  name_prefix          = local.name_prefix
  frontend_bucket_name = local.frontend_bucket_name
  force_destroy        = var.force_destroy_buckets
  domain_aliases       = var.frontend_domain_aliases
  acm_certificate_arn  = var.acm_certificate_arn
  enable_api_behavior  = var.enable_api_behavior
  alb_dns_name         = module.compute_api.alb_dns_name
}
