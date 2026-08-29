# ---------------------------------------------------------------------------
# Modulo compute_api: la API NestJS en ECS Fargate detras de un ALB.
# - Cluster ECS Fargate.
# - Task definition + service (sin estado, autoscaling horizontal).
# - ALB publico -> target group -> tareas en subnets privadas.
# - Autoscaling target tracking por CPU.
# - IAM de menor privilegio: execution role (pull ECR + logs + leer secreto);
#   task role (leer secreto BD, publicar SNS, usar SQS de alertas, leer S3).
# - Log group CloudWatch.
# - ECR opcional si no se provee una imagen.
# ---------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

locals {
  # Si no se pasa imagen, se crea un ECR y se usa una imagen placeholder publica
  # para que el servicio arranque; el primer deploy real hace push al ECR.
  create_ecr      = var.container_image == ""
  ecr_repo_url    = local.create_ecr ? aws_ecr_repository.api[0].repository_url : null
  container_image = local.create_ecr ? "public.ecr.aws/docker/library/busybox:latest" : var.container_image
}

# ---- ECR (opcional) -------------------------------------------------------
resource "aws_ecr_repository" "api" {
  count                = local.create_ecr ? 1 : 0
  name                 = "${var.name_prefix}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.name_prefix}-api"
  }
}

# ---- Log group ------------------------------------------------------------
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.name_prefix}-api"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.name_prefix}-api-logs"
  }
}

# ---- IAM: execution role --------------------------------------------------
# Rol que usa el agente de ECS para arrancar la task (pull de ECR, logs).
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-api-exec-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Name = "${var.name_prefix}-api-exec-role"
  }
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# El execution role debe poder leer el secreto de la BD para inyectarlo como
# variable de entorno segura en el contenedor.
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

# ---- IAM: task role -------------------------------------------------------
# Permisos de la aplicacion en runtime (menor privilegio).
resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-api-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Name = "${var.name_prefix}-api-task-role"
  }
}

data "aws_iam_policy_document" "task" {
  # Leer el secreto de la BD tambien en runtime (rotacion / relectura).
  statement {
    sid       = "ReadDbSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.db_secret_arn]
  }

  # Publicar alertas en SNS.
  statement {
    sid       = "PublishAlerts"
    actions   = ["sns:Publish"]
    resources = [var.sns_alerts_topic_arn]
  }

  # Encolar evaluaciones de alerta.
  statement {
    sid = "AlertsQueue"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl"
    ]
    resources = [var.alerts_queue_arn]
  }

  # Leer PDFs del bucket (URLs prefirmadas para descarga).
  statement {
    sid = "ReadRawBucket"
    actions = [
      "s3:GetObject",
      "s3:ListBucket"
    ]
    resources = [
      var.raw_bucket_arn,
      "${var.raw_bucket_arn}/*"
    ]
  }

  # Enviar correos de alerta via SES.
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
  name   = "${var.name_prefix}-api-task-policy"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# ---- Cluster --------------------------------------------------------------
resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.name_prefix}-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# ---- Task definition ------------------------------------------------------
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = local.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      # Config no sensible como env; la credencial de BD llega via secrets.
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "API_PORT", value = tostring(var.container_port) },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "API_CORS_ORIGIN", value = var.cors_origin },
        { name = "S3_RAW_BOLETINES_BUCKET", value = var.raw_bucket_name },
        { name = "SQS_ALERTS_QUEUE_URL", value = var.alerts_queue_url },
        { name = "SQS_PARSE_QUEUE_URL", value = var.parse_queue_url },
        { name = "SNS_ALERTS_TOPIC_ARN", value = var.sns_alerts_topic_arn },
        { name = "COGNITO_USER_POOL_ID", value = var.cognito_user_pool_id },
        { name = "COGNITO_CLIENT_ID", value = var.cognito_client_id },
        { name = "COGNITO_REGION", value = var.aws_region },
        { name = "SES_FROM_EMAIL", value = var.ses_from_email }
      ]

      # DATABASE_URL / credenciales inyectadas de forma segura desde el secreto.
      secrets = [
        { name = "DB_USERNAME", valueFrom = "${var.db_secret_arn}:username::" },
        { name = "DB_PASSWORD", valueFrom = "${var.db_secret_arn}:password::" },
        { name = "DB_HOST", valueFrom = "${var.db_secret_arn}:host::" },
        { name = "DB_PORT", valueFrom = "${var.db_secret_arn}:port::" },
        { name = "DB_NAME", valueFrom = "${var.db_secret_arn}:dbname::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])

  tags = {
    Name = "${var.name_prefix}-api"
  }
}

# ---- ALB ------------------------------------------------------------------
resource "aws_lb" "this" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  tags = {
    Name = "${var.name_prefix}-alb"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "${var.name_prefix}-api-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # Fargate usa ENIs => targets por IP.

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200-399"
  }

  tags = {
    Name = "${var.name_prefix}-api-tg"
  }
}

# Listener HTTP. En prod agregar listener HTTPS (443) con certificado ACM y
# redirigir 80 -> 443. Se deja HTTP para simplicidad en dev.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ---- Service --------------------------------------------------------------
resource "aws_ecs_service" "api" {
  name            = "${var.name_prefix}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.api_security_group_id]
    assign_public_ip = false # tareas en subnets privadas, salen por NAT.
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  # Espera a que el ALB este listo antes de registrar targets.
  depends_on = [aws_lb_listener.http]

  # El count real lo maneja autoscaling; ignoramos desired_count tras el arranque.
  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Name = "${var.name_prefix}-api"
  }
}

# ---- Autoscaling ----------------------------------------------------------
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Target tracking por CPU al 60%.
resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.name_prefix}-api-cpu-tt"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
