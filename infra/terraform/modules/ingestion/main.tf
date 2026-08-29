# ---------------------------------------------------------------------------
# Modulo ingestion: downloader (cron), parser (consume SQS) y alert matcher.
#
# DECISION Fargate vs Lambda:
#   Se elige ECS Fargate para estas cargas y NO Lambda porque:
#     * El parsing de PDF (pdf-parse + fallback a Textract asincrono) y la
#       descarga paginada desde Nexus PJ pueden superar el limite de 15 min de
#       Lambda y necesitar mas memoria/CPU sostenida.
#     * Las dependencias nativas de parsing y el manejo de archivos grandes en
#       disco encajan mejor en un contenedor de larga duracion.
#     * El worker de parsing corre como servicio Fargate de larga vida que
#       hace long-polling de la cola SQS (un servicio Fargate no admite el
#       "event source mapping" de SQS, exclusivo de Lambda), y escala segun la
#       profundidad de la cola via Application Auto Scaling.
#   La ingesta diaria se dispara con EventBridge -> ECS RunTask (tarea puntual).
# ---------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

locals {
  create_ecr      = var.container_image == ""
  ecr_repo_url    = local.create_ecr ? aws_ecr_repository.ingestion[0].repository_url : null
  container_image = local.create_ecr ? "public.ecr.aws/docker/library/busybox:latest" : var.container_image

  # Variables de entorno comunes a todos los workers (config no sensible).
  common_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "AWS_REGION", value = var.aws_region },
    { name = "S3_RAW_BOLETINES_BUCKET", value = var.raw_bucket_name },
    { name = "SQS_PARSE_QUEUE_URL", value = var.parse_queue_url },
    { name = "SQS_ALERTS_QUEUE_URL", value = var.alerts_queue_url },
    { name = "SNS_ALERTS_TOPIC_ARN", value = var.sns_alerts_topic_arn },
    { name = "SES_FROM_EMAIL", value = var.ses_from_email },
    { name = "NEXUS_PJ_BASE_URL", value = var.nexus_pj_base_url },
    { name = "NEXUS_PJ_QUERY", value = var.nexus_pj_query }
  ]

  # Credenciales de BD inyectadas desde el secreto.
  db_secrets = [
    { name = "DB_USERNAME", valueFrom = "${var.db_secret_arn}:username::" },
    { name = "DB_PASSWORD", valueFrom = "${var.db_secret_arn}:password::" },
    { name = "DB_HOST", valueFrom = "${var.db_secret_arn}:host::" },
    { name = "DB_PORT", valueFrom = "${var.db_secret_arn}:port::" },
    { name = "DB_NAME", valueFrom = "${var.db_secret_arn}:dbname::" }
  ]
}

# ---- ECR (opcional) -------------------------------------------------------
resource "aws_ecr_repository" "ingestion" {
  count                = local.create_ecr ? 1 : 0
  name                 = "${var.name_prefix}-ingestion"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.name_prefix}-ingestion"
  }
}

# ---- Log group ------------------------------------------------------------
resource "aws_cloudwatch_log_group" "ingestion" {
  name              = "/ecs/${var.name_prefix}-ingestion"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.name_prefix}-ingestion-logs"
  }
}

# ---- Cluster --------------------------------------------------------------
resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-ingestion"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.name_prefix}-ingestion"
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ---- IAM: assume role compartido ------------------------------------------
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ---- IAM: execution role --------------------------------------------------
resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-ingestion-exec-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Name = "${var.name_prefix}-ingestion-exec-role"
  }
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-db-secret"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [var.db_secret_arn]
      }
    ]
  })
}

# ---- IAM: task role (menor privilegio) ------------------------------------
resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-ingestion-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Name = "${var.name_prefix}-ingestion-task-role"
  }
}

data "aws_iam_policy_document" "task" {
  # S3: subir PDFs crudos (downloader) y leerlos (parser).
  statement {
    sid = "RawBucketReadWrite"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket"
    ]
    resources = [
      var.raw_bucket_arn,
      "${var.raw_bucket_arn}/*"
    ]
  }

  # SQS parsing: consumir (parser) y consultar atributos.
  statement {
    sid = "ParseQueueConsume"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
      "sqs:ChangeMessageVisibility"
    ]
    resources = [var.parse_queue_arn]
  }

  # SQS alertas: producir (parser encola avisos nuevos) y consumir (matcher).
  statement {
    sid = "AlertsQueueProduceConsume"
    actions = [
      "sqs:SendMessage",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
      "sqs:ChangeMessageVisibility"
    ]
    resources = [var.alerts_queue_arn]
  }

  # Textract: OCR de boletines escaneados.
  statement {
    sid = "Textract"
    actions = [
      "textract:DetectDocumentText",
      "textract:AnalyzeDocument",
      "textract:StartDocumentTextDetection",
      "textract:GetDocumentTextDetection"
    ]
    resources = ["*"] # Textract no soporta permisos a nivel de recurso.
  }

  # BD: leer secreto en runtime.
  statement {
    sid       = "ReadDbSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.db_secret_arn]
  }

  # Notificaciones: el alert matcher publica en SNS y envia correos SES.
  statement {
    sid       = "PublishAlerts"
    actions   = ["sns:Publish"]
    resources = [var.sns_alerts_topic_arn]
  }

  statement {
    sid = "SendEmail"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "${var.name_prefix}-ingestion-task-policy"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# ---- Task definitions -----------------------------------------------------
# Downloader (ingesta diaria): tarea puntual disparada por EventBridge.
resource "aws_ecs_task_definition" "downloader" {
  family                   = "${var.name_prefix}-downloader"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name        = "downloader"
      image       = local.container_image
      essential   = true
      command     = ["node", "dist/main.js", "download"]
      environment = local.common_environment
      secrets     = local.db_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ingestion.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "downloader"
        }
      }
    }
  ])

  tags = {
    Name = "${var.name_prefix}-downloader"
  }
}

# Parser: servicio de larga duracion que hace long-polling de la cola de parsing.
resource "aws_ecs_task_definition" "parser" {
  family                   = "${var.name_prefix}-parser"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name        = "parser"
      image       = local.container_image
      essential   = true
      command     = ["node", "dist/main.js", "parse-worker"]
      environment = local.common_environment
      secrets     = local.db_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ingestion.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "parser"
        }
      }
    }
  ])

  tags = {
    Name = "${var.name_prefix}-parser"
  }
}

# Alert matcher: servicio de larga duracion que consume la cola de alertas.
resource "aws_ecs_task_definition" "matcher" {
  family                   = "${var.name_prefix}-matcher"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name        = "matcher"
      image       = local.container_image
      essential   = true
      command     = ["node", "dist/main.js", "alert-worker"]
      environment = local.common_environment
      secrets     = local.db_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ingestion.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "matcher"
        }
      }
    }
  ])

  tags = {
    Name = "${var.name_prefix}-matcher"
  }
}

# ---- Servicios de larga duracion (parser + matcher) -----------------------
resource "aws_ecs_service" "parser" {
  name            = "${var.name_prefix}-parser"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.parser.arn
  desired_count   = var.parse_worker_min_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.workers_security_group_id]
    assign_public_ip = false
  }

  lifecycle {
    ignore_changes = [desired_count] # lo gestiona autoscaling.
  }

  tags = {
    Name = "${var.name_prefix}-parser"
  }
}

resource "aws_ecs_service" "matcher" {
  name            = "${var.name_prefix}-matcher"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.matcher.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.workers_security_group_id]
    assign_public_ip = false
  }

  tags = {
    Name = "${var.name_prefix}-matcher"
  }
}

# ---- Autoscaling del parser por profundidad de la cola --------------------
resource "aws_appautoscaling_target" "parser" {
  max_capacity       = var.parse_worker_max_count
  min_capacity       = var.parse_worker_min_count
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.parser.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Escala buscando mantener ~10 mensajes visibles por tarea en la cola de parsing.
resource "aws_appautoscaling_policy" "parser_queue_depth" {
  name               = "${var.name_prefix}-parser-queue-tt"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.parser.resource_id
  scalable_dimension = aws_appautoscaling_target.parser.scalable_dimension
  service_namespace  = aws_appautoscaling_target.parser.service_namespace

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"

      dimensions {
        name  = "QueueName"
        value = var.parse_queue_name
      }
    }
    target_value       = 10
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ---- EventBridge: cron diario -> RunTask downloader -----------------------
resource "aws_cloudwatch_event_rule" "daily_ingest" {
  name                = "${var.name_prefix}-daily-ingest"
  description         = "Dispara la ingesta diaria de boletines"
  schedule_expression = var.schedule_expression

  tags = {
    Name = "${var.name_prefix}-daily-ingest"
  }
}

# Rol que asume EventBridge para lanzar la tarea ECS.
data "aws_iam_policy_document" "events_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "events" {
  name               = "${var.name_prefix}-events-role"
  assume_role_policy = data.aws_iam_policy_document.events_assume.json

  tags = {
    Name = "${var.name_prefix}-events-role"
  }
}

data "aws_iam_policy_document" "events" {
  statement {
    sid       = "RunDownloaderTask"
    actions   = ["ecs:RunTask"]
    resources = ["${aws_ecs_task_definition.downloader.arn_without_revision}:*"]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [aws_ecs_cluster.this.arn]
    }
  }

  # EventBridge necesita pasar los roles de la task al servicio ECS.
  statement {
    sid       = "PassEcsRoles"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.execution.arn, aws_iam_role.task.arn]

    condition {
      test     = "StringLike"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "events" {
  name   = "${var.name_prefix}-events-policy"
  role   = aws_iam_role.events.id
  policy = data.aws_iam_policy_document.events.json
}

resource "aws_cloudwatch_event_target" "daily_ingest" {
  rule     = aws_cloudwatch_event_rule.daily_ingest.name
  arn      = aws_ecs_cluster.this.arn
  role_arn = aws_iam_role.events.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.downloader.arn
    task_count          = 1
    launch_type         = "FARGATE"

    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = [var.workers_security_group_id]
      assign_public_ip = false
    }
  }
}
