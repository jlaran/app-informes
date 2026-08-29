# ---------------------------------------------------------------------------
# Variables globales del stack. Cada modulo declara ademas sus propias
# variables; aqui viven las transversales y las que se pasan a varios modulos.
# ---------------------------------------------------------------------------

variable "project" {
  description = "Nombre del proyecto. Se usa como prefijo de todos los recursos."
  type        = string
  default     = "informes"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.project))
    error_message = "project debe ser minusculas/numeros/guiones, empezar con letra y tener <= 21 caracteres."
  }
}

variable "environment" {
  description = "Entorno de despliegue (dev, staging, prod)."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment debe ser uno de: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "Region principal de AWS donde se despliega el stack."
  type        = string
  default     = "us-east-1"
}

# ---- Red ------------------------------------------------------------------

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Cantidad de zonas de disponibilidad a usar (minimo 2 para alta disponibilidad)."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count debe estar entre 2 y 3."
  }
}

variable "single_nat_gateway" {
  description = "Si es true crea un unico NAT Gateway (mas barato, sin HA), ideal para dev. En prod usar false (un NAT por AZ)."
  type        = bool
  default     = true
}

# ---- Base de datos (Aurora Serverless v2) ---------------------------------

variable "db_name" {
  description = "Nombre de la base de datos inicial."
  type        = string
  default     = "informes"
}

variable "db_master_username" {
  description = "Usuario administrador del cluster Aurora. NOTA: el rol de aplicacion (informes_app) sin BYPASSRLS se crea via migraciones, no aqui."
  type        = string
  default     = "informes_admin"
}

variable "db_min_capacity_acu" {
  description = "Capacidad minima de Aurora Serverless v2 en ACU (0.5 en incrementos de 0.5). 0 permite auto-pausa (Aurora Serverless v2 >= scaling reciente)."
  type        = number
  default     = 0.5
}

variable "db_max_capacity_acu" {
  description = "Capacidad maxima de Aurora Serverless v2 en ACU."
  type        = number
  default     = 4
}

variable "db_engine_version" {
  description = "Version del engine aurora-postgresql. Debe soportar Serverless v2."
  type        = string
  default     = "16.4"
}

variable "db_deletion_protection" {
  description = "Proteccion contra borrado del cluster. Recomendado true en prod."
  type        = bool
  default     = false
}

# ---- API (ECS Fargate) ----------------------------------------------------

variable "api_image" {
  description = "Imagen de contenedor de la API (NestJS). Si se deja vacia, el modulo crea un repositorio ECR y usa un placeholder hasta el primer push."
  type        = string
  default     = ""
}

variable "api_container_port" {
  description = "Puerto donde escucha la API dentro del contenedor."
  type        = number
  default     = 4000
}

variable "api_desired_count" {
  description = "Numero deseado de tareas de la API al arrancar."
  type        = number
  default     = 2
}

variable "api_cpu" {
  description = "CPU (unidades) para la task de la API. 256 = 0.25 vCPU."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memoria (MiB) para la task de la API."
  type        = number
  default     = 1024
}

variable "api_min_capacity" {
  description = "Minimo de tareas para el autoscaling de la API."
  type        = number
  default     = 2
}

variable "api_max_capacity" {
  description = "Maximo de tareas para el autoscaling de la API."
  type        = number
  default     = 10
}

variable "api_cors_origin" {
  description = "Origen permitido para CORS en la API (dominio del frontend)."
  type        = string
  default     = "*"
}

# ---- Ingesta --------------------------------------------------------------

variable "ingestion_image" {
  description = "Imagen de contenedor del worker de ingesta/parsing. Si se deja vacia, el modulo crea un repositorio ECR."
  type        = string
  default     = ""
}

variable "ingestion_schedule_expression" {
  description = "Expresion de EventBridge para el cron de ingesta diaria. Por defecto: 06:00 UTC (00:00 CR)."
  type        = string
  default     = "cron(0 6 * * ? *)"
}

variable "ingestion_cpu" {
  description = "CPU para las tareas de ingesta/parsing (parsing de PDF puede ser pesado)."
  type        = number
  default     = 1024
}

variable "ingestion_memory" {
  description = "Memoria (MiB) para las tareas de ingesta/parsing."
  type        = number
  default     = 2048
}

# ---- Notificaciones -------------------------------------------------------

variable "ses_from_email" {
  description = "Direccion de correo remitente verificada en SES para las alertas."
  type        = string
  default     = "alertas@informes.example.com"
}

variable "ses_verify_domain" {
  description = "Dominio a verificar en SES (opcional). Si se define, se crea una identidad de dominio ademas de la de email."
  type        = string
  default     = ""
}

# ---- CDN / Frontend -------------------------------------------------------

variable "frontend_domain_aliases" {
  description = "Dominios alternativos (CNAMEs) para la distribucion de CloudFront. Requiere acm_certificate_arn."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ARN de un certificado ACM en us-east-1 para CloudFront. Si es vacio se usa el certificado por defecto de CloudFront (*.cloudfront.net)."
  type        = string
  default     = ""
}

variable "enable_api_behavior" {
  description = "Si es true, agrega a CloudFront un comportamiento /api/* que enruta hacia el ALB de la API."
  type        = bool
  default     = true
}

# ---- Buckets S3 -----------------------------------------------------------

variable "raw_bucket_name" {
  description = "Nombre del bucket de PDFs crudos. Vacio => se deriva <project>-raw-boletines-<environment>. Debe coincidir con S3_RAW_BOLETINES_BUCKET."
  type        = string
  default     = ""
}

variable "frontend_bucket_name" {
  description = "Nombre del bucket del frontend estatico. Vacio => se deriva <project>-web-<environment>."
  type        = string
  default     = ""
}

variable "force_destroy_buckets" {
  description = "Permite destruir buckets con objetos (util en dev, peligroso en prod)."
  type        = bool
  default     = false
}

# ---- Logs -----------------------------------------------------------------

variable "log_retention_days" {
  description = "Dias de retencion de los grupos de logs de CloudWatch."
  type        = number
  default     = 30
}
