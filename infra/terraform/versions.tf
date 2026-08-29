# ---------------------------------------------------------------------------
# Versiones requeridas de Terraform y providers.
# Se fija AWS provider ~> 5.0 (5.x) y Terraform >= 1.7 para soportar la
# sintaxis moderna (p.ej. bloques `moved`, validaciones, `optional()` en tipos).
# random y tls se usan para generar la contraseña de la BD y el key pair no aplica.
# ---------------------------------------------------------------------------
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
