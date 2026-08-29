output "cluster_endpoint" {
  description = "Endpoint writer del cluster Aurora."
  value       = aws_rds_cluster.this.endpoint
}

output "reader_endpoint" {
  description = "Endpoint reader del cluster Aurora."
  value       = aws_rds_cluster.this.reader_endpoint
}

output "port" {
  description = "Puerto de la BD."
  value       = aws_rds_cluster.this.port
}

output "database_name" {
  description = "Nombre de la base de datos inicial."
  value       = aws_rds_cluster.this.database_name
}

output "secret_arn" {
  description = "ARN del secreto en Secrets Manager con las credenciales de la BD."
  value       = aws_secretsmanager_secret.db.arn
}

output "security_group_id" {
  description = "SG del cluster Aurora."
  value       = aws_security_group.db.id
}
