variable "name_prefix" {
  description = "Prefijo de nombre de los recursos."
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC."
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs de las subnets privadas donde vive el cluster."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "SGs que pueden conectarse a la BD (API y workers). Menor privilegio."
  type        = list(string)
}

variable "db_name" {
  description = "Nombre de la base de datos inicial."
  type        = string
}

variable "master_username" {
  description = "Usuario administrador del cluster."
  type        = string
}

variable "engine_version" {
  description = "Version de aurora-postgresql."
  type        = string
}

variable "min_capacity_acu" {
  description = "Capacidad minima Serverless v2 (ACU)."
  type        = number
}

variable "max_capacity_acu" {
  description = "Capacidad maxima Serverless v2 (ACU)."
  type        = number
}

variable "deletion_protection" {
  description = "Proteccion contra borrado."
  type        = bool
}

variable "backup_retention_days" {
  description = "Dias de retencion de backups automaticos."
  type        = number
  default     = 7
}
