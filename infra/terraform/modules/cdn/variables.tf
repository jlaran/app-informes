variable "name_prefix" {
  description = "Prefijo de nombre de los recursos."
  type        = string
}

variable "frontend_bucket_name" {
  description = "Nombre del bucket S3 del frontend estatico. Debe ser globalmente unico."
  type        = string
}

variable "force_destroy" {
  description = "Permite destruir el bucket con objetos (dev)."
  type        = bool
  default     = false
}

variable "default_root_object" {
  description = "Objeto raiz por defecto que sirve CloudFront."
  type        = string
  default     = "index.html"
}

variable "domain_aliases" {
  description = "CNAMEs alternativos de la distribucion. Requiere acm_certificate_arn."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ARN de certificado ACM en us-east-1. Vacio => certificado por defecto de CloudFront."
  type        = string
  default     = ""
}

variable "enable_api_behavior" {
  description = "Agrega un comportamiento /api/* que enruta al ALB."
  type        = bool
  default     = true
}

variable "alb_dns_name" {
  description = "DNS del ALB de la API (origen para /api/*)."
  type        = string
  default     = ""
}

variable "price_class" {
  description = "Price class de CloudFront (limita las edge locations / costo)."
  type        = string
  default     = "PriceClass_100"
}
