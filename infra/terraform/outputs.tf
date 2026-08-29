# ---------------------------------------------------------------------------
# Outputs clave del stack. Muchos coinciden con las variables de entorno que la
# app espera (.env.example): S3_RAW_BOLETINES_BUCKET, SQS_*_QUEUE_URL,
# COGNITO_*, SNS_ALERTS_TOPIC_ARN, etc.
# ---------------------------------------------------------------------------

# ---- Red ------------------------------------------------------------------
output "vpc_id" {
  description = "ID de la VPC."
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "Subnets privadas."
  value       = module.networking.private_subnet_ids
}

# ---- Base de datos --------------------------------------------------------
output "aurora_cluster_endpoint" {
  description = "Endpoint writer de Aurora."
  value       = module.database.cluster_endpoint
}

output "aurora_reader_endpoint" {
  description = "Endpoint reader de Aurora."
  value       = module.database.reader_endpoint
}

output "db_secret_arn" {
  description = "ARN del secreto con credenciales de la BD (construir DATABASE_URL desde aqui)."
  value       = module.database.secret_arn
}

# ---- Colas (SQS) ----------------------------------------------------------
output "sqs_parse_queue_url" {
  description = "SQS_PARSE_QUEUE_URL"
  value       = module.queues.parse_queue_url
}

output "sqs_alerts_queue_url" {
  description = "SQS_ALERTS_QUEUE_URL"
  value       = module.queues.alerts_queue_url
}

output "sqs_parse_dlq_url" {
  description = "URL de la DLQ de parsing."
  value       = module.queues.parse_dlq_url
}

output "sqs_alerts_dlq_url" {
  description = "URL de la DLQ de alertas."
  value       = module.queues.alerts_dlq_url
}

# ---- Almacenamiento -------------------------------------------------------
output "s3_raw_boletines_bucket" {
  description = "S3_RAW_BOLETINES_BUCKET"
  value       = module.storage.bucket_name
}

# ---- Auth (Cognito) -------------------------------------------------------
output "cognito_user_pool_id" {
  description = "COGNITO_USER_POOL_ID"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "COGNITO_CLIENT_ID"
  value       = module.auth.client_id
}

output "cognito_user_pool_domain" {
  description = "Dominio hospedado de Cognito."
  value       = module.auth.user_pool_domain
}

# ---- Notificaciones -------------------------------------------------------
output "sns_alerts_topic_arn" {
  description = "SNS_ALERTS_TOPIC_ARN"
  value       = module.notifications.alerts_topic_arn
}

output "ses_from_email" {
  description = "SES_FROM_EMAIL (recordar verificar la identidad en SES)."
  value       = module.notifications.ses_from_email
}

# ---- API (ECS + ALB) ------------------------------------------------------
output "api_alb_dns_name" {
  description = "DNS publico del ALB de la API."
  value       = module.compute_api.alb_dns_name
}

output "api_ecr_repository_url" {
  description = "URL del ECR de la API (push de la imagen NestJS). null si se uso imagen externa."
  value       = module.compute_api.ecr_repository_url
}

output "api_cluster_name" {
  description = "Nombre del cluster ECS de la API."
  value       = module.compute_api.cluster_name
}

# ---- Ingesta --------------------------------------------------------------
output "ingestion_ecr_repository_url" {
  description = "URL del ECR de ingesta. null si se uso imagen externa."
  value       = module.ingestion.ecr_repository_url
}

output "ingestion_cluster_name" {
  description = "Nombre del cluster ECS de ingesta."
  value       = module.ingestion.cluster_name
}

# ---- CDN ------------------------------------------------------------------
output "cloudfront_domain_name" {
  description = "Dominio de CloudFront (frontend)."
  value       = module.cdn.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "ID de la distribucion CloudFront (para invalidaciones)."
  value       = module.cdn.cloudfront_distribution_id
}

output "frontend_bucket_name" {
  description = "Bucket del frontend estatico (destino del `next export`)."
  value       = module.cdn.frontend_bucket_name
}
