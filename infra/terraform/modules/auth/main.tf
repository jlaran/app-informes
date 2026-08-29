# ---------------------------------------------------------------------------
# Modulo auth: Cognito User Pool + Client con atributo custom "tenant_id".
# El claim tenant_id se resuelve en cada request de la API y fija la tenancy
# (SET LOCAL app.current_tenant) para la RLS de PostgreSQL.
# ---------------------------------------------------------------------------

resource "aws_cognito_user_pool" "this" {
  name = "${var.name_prefix}-users"

  # Login por email.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # MFA opcional (TOTP) para reforzar la seguridad de cuentas.
  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }

  # Atributo custom tenant_id: identifica a que tenant pertenece el usuario.
  # mutable=true para poder reasignar tenant en operaciones administrativas.
  schema {
    name                     = "tenant_id"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 64
    }
  }

  # Rol del usuario dentro del tenant (owner, admin, member).
  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 32
    }
  }

  tags = {
    Name = "${var.name_prefix}-users"
  }
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = "${var.name_prefix}-auth"
  user_pool_id = aws_cognito_user_pool.this.id
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name_prefix}-web-client"
  user_pool_id = aws_cognito_user_pool.this.id

  # SPA / servidor Next.js: sin secreto de cliente (public client con PKCE).
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  # La app puede leer/escribir el tenant_id del usuario.
  read_attributes  = ["email", "custom:tenant_id", "custom:role"]
  write_attributes = ["email", "custom:tenant_id", "custom:role"]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}
