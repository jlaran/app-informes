# ---------------------------------------------------------------------------
# Modulo storage: bucket S3 privado para los PDF crudos de boletines.
# - Versionado (idempotencia / recuperacion ante reprocesos).
# - Encriptacion SSE (SSE-S3 / AES256) por defecto.
# - Block Public Access total.
# - Lifecycle: STANDARD -> STANDARD_IA -> GLACIER (los boletines antiguos se
#   consultan rara vez, se abarata el almacenamiento).
# - Notificacion S3 -> SQS(parse) al subir un nuevo PDF.
# ---------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "raw" {
  bucket        = var.bucket_name
  force_destroy = var.force_destroy

  tags = {
    Name = var.bucket_name
  }
}

resource "aws_s3_bucket_versioning" "raw" {
  bucket = aws_s3_bucket.raw.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "raw" {
  bucket = aws_s3_bucket.raw.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Bloqueo total de acceso publico: los PDFs no deben ser accesibles desde internet.
resource "aws_s3_bucket_public_access_block" "raw" {
  bucket = aws_s3_bucket.raw.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Fuerza TLS en todas las operaciones sobre el bucket.
resource "aws_s3_bucket_policy" "raw_tls" {
  bucket = aws_s3_bucket.raw.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.raw.arn,
          "${aws_s3_bucket.raw.arn}/*"
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.raw]
}

resource "aws_s3_bucket_lifecycle_configuration" "raw" {
  bucket = aws_s3_bucket.raw.id

  rule {
    id     = "archive-old-boletines"
    status = "Enabled"

    filter {
      prefix = var.notification_prefix
    }

    transition {
      days          = var.ia_transition_days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = var.glacier_transition_days
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }
  }
}

# ---- Notificacion S3 -> SQS ----------------------------------------------
# Policy en la cola de parsing que permite a S3 (de esta cuenta y este bucket)
# enviar mensajes. Se define aqui para romper la dependencia circular con el
# modulo queues (queues expone solo el ARN; storage concede el permiso).
resource "aws_sqs_queue_policy" "allow_s3" {
  queue_url = var.parse_queue_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowS3ToSendMessage"
        Effect    = "Allow"
        Principal = { Service = "s3.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = var.parse_queue_arn
        Condition = {
          ArnEquals    = { "aws:SourceArn" = aws_s3_bucket.raw.arn }
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_notification" "raw_to_parse" {
  bucket = aws_s3_bucket.raw.id

  queue {
    queue_arn     = var.parse_queue_arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = var.notification_prefix
    filter_suffix = var.notification_suffix
  }

  # La policy de la cola debe existir antes de configurar la notificacion.
  depends_on = [aws_sqs_queue_policy.allow_s3]
}
