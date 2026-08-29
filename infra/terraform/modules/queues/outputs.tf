output "parse_queue_url" {
  description = "URL de la cola de parsing."
  value       = aws_sqs_queue.parse.id
}

output "parse_queue_arn" {
  description = "ARN de la cola de parsing."
  value       = aws_sqs_queue.parse.arn
}

output "parse_dlq_url" {
  description = "URL de la DLQ de parsing."
  value       = aws_sqs_queue.parse_dlq.id
}

output "parse_dlq_arn" {
  description = "ARN de la DLQ de parsing."
  value       = aws_sqs_queue.parse_dlq.arn
}

output "alerts_queue_url" {
  description = "URL de la cola de alertas."
  value       = aws_sqs_queue.alerts.id
}

output "alerts_queue_arn" {
  description = "ARN de la cola de alertas."
  value       = aws_sqs_queue.alerts.arn
}

output "alerts_dlq_url" {
  description = "URL de la DLQ de alertas."
  value       = aws_sqs_queue.alerts_dlq.id
}

output "alerts_dlq_arn" {
  description = "ARN de la DLQ de alertas."
  value       = aws_sqs_queue.alerts_dlq.arn
}
