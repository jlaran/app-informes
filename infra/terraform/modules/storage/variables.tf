variable "name_prefix" {
  description = "Prefijo de nombre de los recursos."
  type        = string
}

variable "bucket_name" {
  description = "Nombre del bucket S3 de PDFs crudos. Debe ser globalmente unico. Debe coincidir con S3_RAW_BOLETINES_BUCKET de la app."
  type        = string
}

variable "parse_queue_arn" {
  description = "ARN de la cola SQS de parsing a notificar cuando llega un nuevo PDF."
  type        = string
}

variable "parse_queue_id" {
  description = "URL/ID de la cola SQS de parsing (para adjuntar la policy)."
  type        = string
}

variable "notification_prefix" {
  description = "Prefijo dentro del bucket que dispara la notificacion de parsing."
  type        = string
  default     = "raw-boletines/"
}

variable "notification_suffix" {
  description = "Sufijo de archivo que dispara la notificacion (solo PDFs)."
  type        = string
  default     = ".pdf"
}

variable "force_destroy" {
  description = "Permite destruir el bucket aun con objetos (util en dev). En prod: false."
  type        = bool
  default     = false
}

variable "ia_transition_days" {
  description = "Dias tras los cuales los objetos pasan a STANDARD_IA."
  type        = number
  default     = 30
}

variable "glacier_transition_days" {
  description = "Dias tras los cuales los objetos pasan a GLACIER."
  type        = number
  default     = 90
}

variable "noncurrent_version_expiration_days" {
  description = "Dias tras los cuales se eliminan versiones antiguas (no actuales)."
  type        = number
  default     = 90
}
