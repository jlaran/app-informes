variable "name_prefix" {
  description = "Prefijo de nombre de los recursos."
  type        = string
}

variable "max_receive_count" {
  description = "Numero de reintentos antes de mover un mensaje a la DLQ."
  type        = number
  default     = 5
}

variable "visibility_timeout_seconds" {
  description = "Tiempo de invisibilidad de un mensaje en proceso. Debe ser >= al timeout del consumidor (parsing de PDF puede ser largo)."
  type        = number
  default     = 900
}

variable "message_retention_seconds" {
  description = "Retencion de mensajes en la cola principal (segundos)."
  type        = number
  default     = 345600 # 4 dias
}

variable "dlq_retention_seconds" {
  description = "Retencion de mensajes en la DLQ (segundos)."
  type        = number
  default     = 1209600 # 14 dias, maximo, para poder investigar fallos
}
