# ---------------------------------------------------------------------------
# Modulo notifications: SNS (alertas/push) + identidades SES (email de alertas).
# - SNS topic para fan-out de alertas (push, integraciones, etc.).
# - SES: identidad de email remitente y, opcionalmente, de dominio.
#
# NOTA: la verificacion de la identidad SES requiere confirmar el correo o
# publicar registros DNS (dominio). Terraform crea la identidad pero la
# verificacion la completa el operador. En sandbox de SES solo se puede enviar
# a direcciones verificadas: solicitar salida de sandbox para produccion.
# ---------------------------------------------------------------------------

# ---- SNS ------------------------------------------------------------------
resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"

  tags = {
    Name = "${var.name_prefix}-alerts"
  }
}

# Politica del topic: permite publicar a los principales de la cuenta.
# El permiso fino se otorga a los roles IAM de compute/ingesta (sns:Publish).
data "aws_caller_identity" "current" {}

resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowAccountPublish"
        Effect    = "Allow"
        Principal = { AWS = data.aws_caller_identity.current.account_id }
        Action = [
          "sns:Publish",
          "sns:Subscribe"
        ]
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}

# ---- SES ------------------------------------------------------------------
resource "aws_ses_email_identity" "from" {
  email = var.ses_from_email
}

# Identidad de dominio opcional (recomendada para envios masivos + DKIM).
resource "aws_ses_domain_identity" "domain" {
  count  = var.ses_verify_domain != "" ? 1 : 0
  domain = var.ses_verify_domain
}

resource "aws_ses_domain_dkim" "domain" {
  count  = var.ses_verify_domain != "" ? 1 : 0
  domain = aws_ses_domain_identity.domain[0].domain
}
