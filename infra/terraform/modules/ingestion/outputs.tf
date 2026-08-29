output "cluster_arn" {
  description = "ARN del cluster ECS de ingesta."
  value       = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  description = "Nombre del cluster ECS de ingesta."
  value       = aws_ecs_cluster.this.name
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR de ingesta (null si se paso una imagen externa)."
  value       = local.ecr_repo_url
}

output "downloader_task_definition_arn" {
  description = "ARN de la task definition del downloader."
  value       = aws_ecs_task_definition.downloader.arn
}

output "parser_service_name" {
  description = "Nombre del servicio del parser."
  value       = aws_ecs_service.parser.name
}

output "matcher_service_name" {
  description = "Nombre del servicio del alert matcher."
  value       = aws_ecs_service.matcher.name
}

output "task_role_arn" {
  description = "ARN del task role de ingesta."
  value       = aws_iam_role.task.arn
}

output "schedule_rule_arn" {
  description = "ARN de la regla EventBridge de ingesta diaria."
  value       = aws_cloudwatch_event_rule.daily_ingest.arn
}

output "log_group_name" {
  description = "Nombre del log group de ingesta."
  value       = aws_cloudwatch_log_group.ingestion.name
}
