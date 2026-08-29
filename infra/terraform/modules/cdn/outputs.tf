output "cloudfront_domain_name" {
  description = "Dominio de la distribucion CloudFront (*.cloudfront.net)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "cloudfront_distribution_id" {
  description = "ID de la distribucion CloudFront (para invalidaciones en el deploy)."
  value       = aws_cloudfront_distribution.this.id
}

output "cloudfront_distribution_arn" {
  description = "ARN de la distribucion CloudFront."
  value       = aws_cloudfront_distribution.this.arn
}

output "frontend_bucket_name" {
  description = "Nombre del bucket del frontend."
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  description = "ARN del bucket del frontend."
  value       = aws_s3_bucket.frontend.arn
}
