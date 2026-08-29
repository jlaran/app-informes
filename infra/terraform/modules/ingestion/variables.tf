variable "name_prefix" {
  description = "Prefijo de nombre de los recursos."
  type        = string
}

variable "aws_region" {
  description = "Region AWS."
  type        = string
}

variable "private_subnet_ids" {
  description = "Subnets privadas donde corren los workers."
  type        = list(string)
}

variable "workers_security_group_id" {
  description = "SG de los workers de ingesta/parsing."
  type        = string
}

variable "container_image" {
  description = "Imagen del worker de ingesta/parsing. Vacio => se crea ECR y se usa placeholder."
  type        = string
}

variable "cpu" {
  description = "CPU de las tasks de ingesta/parsing."
  type        = number
}

variable "memory" {
  description = "Memoria (MiB) de las tasks."
  type        = number
}

variable "schedule_expression" {
  description = "Expresion cron/rate de EventBridge para la ingesta diaria."
  type        = string
}

variable "log_retention_days" {
  description = "Retencion de logs CloudWatch."
  type        = number
}

variable "parse_worker_min_count" {
  description = "Minimo de tareas del worker de parsing."
  type        = number
  default     = 1
}

variable "parse_worker_max_count" {
  description = "Maximo de tareas del worker de parsing (escala con la profundidad de la cola)."
  type        = number
  default     = 5
}

# ---- Integraciones --------------------------------------------------------

variable "db_secret_arn" {
  description = "ARN del secreto de la BD."
  type        = string
}

variable "raw_bucket_arn" {
  description = "ARN del bucket de PDFs crudos."
  type        = string
}

variable "raw_bucket_name" {
  description = "Nombre del bucket de PDFs crudos."
  type        = string
}

variable "parse_queue_arn" {
  description = "ARN de la cola de parsing (consumo)."
  type        = string
}

variable "parse_queue_url" {
  description = "URL de la cola de parsing."
  type        = string
}

variable "parse_queue_name" {
  description = "Nombre de la cola de parsing (para la metrica de autoscaling)."
  type        = string
}

variable "alerts_queue_arn" {
  description = "ARN de la cola de alertas (produccion + consumo)."
  type        = string
}

variable "alerts_queue_url" {
  description = "URL de la cola de alertas."
  type        = string
}

variable "sns_alerts_topic_arn" {
  description = "ARN del topic SNS de alertas."
  type        = string
}

variable "ses_from_email" {
  description = "Remitente SES."
  type        = string
}

variable "nexus_pj_base_url" {
  description = "URL base de Nexus PJ (fuente de boletines)."
  type        = string
  default     = "https://nexuspj.poder-judicial.go.cr"
}

variable "nexus_pj_query" {
  description = "Cadena de busqueda para filtrar el Boletin Judicial."
  type        = string
  default     = "tipoInformacion:(Boletín AND Judicial)"
}
