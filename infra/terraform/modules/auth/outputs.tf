output "user_pool_id" {
  description = "ID del Cognito User Pool."
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "ARN del Cognito User Pool."
  value       = aws_cognito_user_pool.this.arn
}

output "client_id" {
  description = "ID del User Pool Client (web)."
  value       = aws_cognito_user_pool_client.web.id
}

output "user_pool_domain" {
  description = "Dominio hospedado de Cognito."
  value       = aws_cognito_user_pool_domain.this.domain
}
