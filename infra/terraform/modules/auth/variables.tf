variable "name_prefix" {
  description = "Prefijo de nombre de los recursos."
  type        = string
}

variable "callback_urls" {
  description = "URLs de callback OAuth permitidas para el cliente (frontend)."
  type        = list(string)
  default     = ["http://localhost:3000/api/auth/callback"]
}

variable "logout_urls" {
  description = "URLs de logout permitidas."
  type        = list(string)
  default     = ["http://localhost:3000"]
}
