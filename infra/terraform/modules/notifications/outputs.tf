output "alerts_topic_arn" {
  description = "ARN del topic SNS de alertas."
  value       = aws_sns_topic.alerts.arn
}

output "ses_from_email" {
  description = "Direccion de correo remitente configurada en SES."
  value       = aws_ses_email_identity.from.email
}

output "ses_domain_dkim_tokens" {
  description = "Tokens DKIM a publicar como CNAME si se verifica un dominio (vacio si no)."
  value       = var.ses_verify_domain != "" ? aws_ses_domain_dkim.domain[0].dkim_tokens : []
}
