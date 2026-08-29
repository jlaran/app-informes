# ---------------------------------------------------------------------------
# Backend remoto para el state de Terraform.
#
# Se recomienda un backend S3 con bloqueo. A partir de Terraform 1.10+ el
# bloqueo puede hacerse nativamente con S3 (use_lockfile), evitando DynamoDB;
# para versiones anteriores use la opcion `dynamodb_table` (ver README).
#
# Este bloque queda COMENTADO a proposito: el bucket y (opcionalmente) la tabla
# de bloqueo deben existir ANTES de inicializar el backend (problema del huevo
# y la gallina). El README documenta como crearlos. Descomente y ajuste los
# valores, luego ejecute `terraform init -migrate-state`.
#
# NOTA: los valores del backend NO admiten interpolacion de variables; deben ser
# literales o pasarse via `-backend-config` en `terraform init`.
# ---------------------------------------------------------------------------

# terraform {
#   backend "s3" {
#     bucket       = "informes-tfstate-<account-id>"
#     key          = "app-informes/dev/terraform.tfstate"
#     region       = "us-east-1"
#     encrypt      = true
#     use_lockfile = true # bloqueo nativo S3 (Terraform >= 1.10). Alternativa: dynamodb_table.
#   }
# }
