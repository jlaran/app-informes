variable "name_prefix" {
  description = "Prefijo de nombre de los recursos."
  type        = string
}

variable "aws_region" {
  description = "Region AWS (para configurar el log driver)."
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC."
  type        = string
}

variable "public_subnet_ids" {
  description = "Subnets publicas para el ALB."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Subnets privadas para las tareas ECS."
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "SG del ALB."
  type        = string
}

variable "api_security_group_id" {
  description = "SG de las tareas de la API."
  type        = string
}

variable "container_image" {
  description = "Imagen del contenedor de la API. Vacio => se crea ECR y se usa placeholder."
  type        = string
}

variable "container_port" {
  description = "Puerto del contenedor."
  type        = number
}

variable "desired_count" {
  description = "Numero deseado de tareas."
  type        = number
}

variable "cpu" {
  description = "CPU de la task (unidades)."
  type        = number
}

variable "memory" {
  description = "Memoria de la task (MiB)."
  type        = number
}

variable "min_capacity" {
  description = "Minimo de tareas (autoscaling)."
  type        = number
}

variable "max_capacity" {
  description = "Maximo de tareas (autoscaling)."
  type        = number
}

variable "log_retention_days" {
  description = "Retencion de logs CloudWatch."
  type        = number
}

variable "cors_origin" {
  description = "Origen CORS permitido por la API."
  type        = string
}

# ---- Integraciones (ARNs/URLs de otros modulos) ---------------------------

variable "db_secret_arn" {
  description = "ARN del secreto de la BD (para leerlo en runtime)."
  type        = string
}

variable "sns_alerts_topic_arn" {
  description = "ARN del topic SNS de alertas (la API puede publicar)."
  type        = string
}

variable "alerts_queue_arn" {
  description = "ARN de la cola de alertas (la API encola evaluaciones)."
  type        = string
}

variable "alerts_queue_url" {
  description = "URL de la cola de alertas."
  type        = string
}

variable "parse_queue_url" {
  description = "URL de la cola de parsing (para inyectar como env var)."
  type        = string
}

variable "raw_bucket_arn" {
  description = "ARN del bucket de PDFs (la API puede generar URLs prefirmadas de lectura)."
  type        = string
}

variable "raw_bucket_name" {
  description = "Nombre del bucket de PDFs."
  type        = string
}

variable "cognito_user_pool_id" {
  description = "ID del User Pool (env var para la API)."
  type        = string
}

variable "cognito_client_id" {
  description = "ID del client de Cognito (env var para la API)."
  type        = string
}

variable "ses_from_email" {
  description = "Remitente SES (env var)."
  type        = string
}
