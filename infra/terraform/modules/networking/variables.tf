variable "name_prefix" {
  description = "Prefijo de nombre (project-environment-) para todos los recursos."
  type        = string
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC."
  type        = string
}

variable "az_count" {
  description = "Numero de zonas de disponibilidad a usar."
  type        = number
}

variable "single_nat_gateway" {
  description = "Un unico NAT Gateway (dev) vs uno por AZ (prod)."
  type        = bool
}
