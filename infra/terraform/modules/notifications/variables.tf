variable "name_prefix" {
  description = "Prefijo de nombre de los recursos."
  type        = string
}

variable "ses_from_email" {
  description = "Direccion de correo remitente a verificar en SES."
  type        = string
}

variable "ses_verify_domain" {
  description = "Dominio a verificar en SES (opcional). Vacio = no crear identidad de dominio."
  type        = string
  default     = ""
}
