output "cluster_arn" {
  description = "ARN del cluster ECS."
  value       = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  description = "Nombre del cluster ECS."
  value       = aws_ecs_cluster.this.name
}

output "service_name" {
  description = "Nombre del servicio ECS de la API."
  value       = aws_ecs_service.api.name
}

output "alb_dns_name" {
  description = "DNS publico del ALB."
  value       = aws_lb.this.dns_name
}

output "alb_arn" {
  description = "ARN del ALB."
  value       = aws_lb.this.arn
}

output "alb_zone_id" {
  description = "Zone ID del ALB (para registros Route53 tipo alias)."
  value       = aws_lb.this.zone_id
}

output "target_group_arn" {
  description = "ARN del target group de la API."
  value       = aws_lb_target_group.api.arn
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR de la API (null si se paso una imagen externa)."
  value       = local.ecr_repo_url
}

output "task_role_arn" {
  description = "ARN del task role de la API."
  value       = aws_iam_role.task.arn
}

output "log_group_name" {
  description = "Nombre del log group de la API."
  value       = aws_cloudwatch_log_group.api.name
}
