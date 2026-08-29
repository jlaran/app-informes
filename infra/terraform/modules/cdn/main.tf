# ---------------------------------------------------------------------------
# Modulo cdn: frontend estatico (Next.js export) en S3 privado servido via
# CloudFront con Origin Access Control (OAC). Opcionalmente enruta /api/* al ALB.
#
# Seguridad: el bucket es privado (block public access total). El unico que
# puede leerlo es CloudFront, autorizado por OAC + bucket policy con condicion
# aws:SourceArn = ARN de la distribucion.
# ---------------------------------------------------------------------------

locals {
  s3_origin_id  = "s3-frontend"
  alb_origin_id = "alb-api"
  use_acm       = var.acm_certificate_arn != ""
}

# ---- Bucket del frontend --------------------------------------------------
resource "aws_s3_bucket" "frontend" {
  bucket        = var.frontend_bucket_name
  force_destroy = var.force_destroy

  tags = {
    Name = var.frontend_bucket_name
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---- Origin Access Control ------------------------------------------------
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.name_prefix}-oac"
  description                       = "OAC para el frontend de ${var.name_prefix}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---- Politicas gestionadas de cache ---------------------------------------
# Reutilizamos politicas gestionadas por AWS en lugar de definir TTLs a mano.
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewerExceptHostHeader"
}

# ---- Distribucion ---------------------------------------------------------
resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name_prefix} frontend"
  default_root_object = var.default_root_object
  price_class         = var.price_class
  aliases             = local.use_acm ? var.domain_aliases : []

  # Origen S3 (frontend estatico) via OAC.
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origen ALB (API) opcional.
  dynamic "origin" {
    for_each = var.enable_api_behavior ? [1] : []
    content {
      domain_name = var.alb_dns_name
      origin_id   = local.alb_origin_id

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only" # el ALB expone HTTP; en prod usar https-only con cert.
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Comportamiento por defecto: sirve el frontend desde S3.
  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true
  }

  # Comportamiento /api/* -> ALB (sin cache, pasa todo al backend).
  dynamic "ordered_cache_behavior" {
    for_each = var.enable_api_behavior ? [1] : []
    content {
      path_pattern             = "/api/*"
      target_origin_id         = local.alb_origin_id
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
      compress                 = true
    }
  }

  # SPA: rutas del client-side router devuelven index.html.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/${var.default_root_object}"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/${var.default_root_object}"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = local.use_acm ? null : true
    acm_certificate_arn            = local.use_acm ? var.acm_certificate_arn : null
    ssl_support_method             = local.use_acm ? "sni-only" : null
    minimum_protocol_version       = local.use_acm ? "TLSv1.2_2021" : "TLSv1"
  }

  tags = {
    Name = "${var.name_prefix}-cdn"
  }
}

# ---- Bucket policy: solo CloudFront (OAC) puede leer ----------------------
data "aws_iam_policy_document" "frontend" {
  statement {
    sid       = "AllowCloudFrontOAC"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend.json

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}
