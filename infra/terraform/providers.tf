# ---------------------------------------------------------------------------
# Configuracion del provider AWS.
# - La region es parametrizable via var.aws_region.
# - default_tags aplica etiquetas a TODOS los recursos que soporten tags,
#   garantizando trazabilidad (Project / Environment / ManagedBy).
# ---------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Provider secundario anclado a us-east-1: CloudFront exige que el certificado
# ACM asociado a la distribucion resida en us-east-1, independientemente de la
# region principal del despliegue. El modulo cdn lo consume via alias.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
