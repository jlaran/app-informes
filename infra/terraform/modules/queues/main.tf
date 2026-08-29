# ---------------------------------------------------------------------------
# Modulo queues: colas SQS con sus DLQ.
# - parse:  recibe eventos de S3 (nuevo PDF) para disparar el parser.
# - alerts: recibe avisos nuevos para evaluar reglas de alerta.
# Cada cola tiene una DLQ con redrive policy para aislar mensajes envenenados.
# Encriptacion SSE gestionada por SQS (sse_managed) sin costo de KMS.
# ---------------------------------------------------------------------------

# ---- Cola de parsing ------------------------------------------------------
resource "aws_sqs_queue" "parse_dlq" {
  name                      = "${var.name_prefix}-parse-dlq"
  message_retention_seconds = var.dlq_retention_seconds
  sqs_managed_sse_enabled   = true

  tags = {
    Name = "${var.name_prefix}-parse-dlq"
  }
}

resource "aws_sqs_queue" "parse" {
  name                       = "${var.name_prefix}-parse"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.parse_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = {
    Name = "${var.name_prefix}-parse"
  }
}

# Permite que la DLQ solo reciba redrive desde su cola principal.
resource "aws_sqs_queue_redrive_allow_policy" "parse_dlq" {
  queue_url = aws_sqs_queue.parse_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.parse.arn]
  })
}

# ---- Cola de alertas ------------------------------------------------------
resource "aws_sqs_queue" "alerts_dlq" {
  name                      = "${var.name_prefix}-alerts-dlq"
  message_retention_seconds = var.dlq_retention_seconds
  sqs_managed_sse_enabled   = true

  tags = {
    Name = "${var.name_prefix}-alerts-dlq"
  }
}

resource "aws_sqs_queue" "alerts" {
  name                       = "${var.name_prefix}-alerts"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.alerts_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = {
    Name = "${var.name_prefix}-alerts"
  }
}

resource "aws_sqs_queue_redrive_allow_policy" "alerts_dlq" {
  queue_url = aws_sqs_queue.alerts_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.alerts.arn]
  })
}
