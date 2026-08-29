output "bucket_name" {
  description = "Nombre del bucket de PDFs crudos."
  value       = aws_s3_bucket.raw.id
}

output "bucket_arn" {
  description = "ARN del bucket de PDFs crudos."
  value       = aws_s3_bucket.raw.arn
}
