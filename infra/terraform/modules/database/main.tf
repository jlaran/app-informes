# ---------------------------------------------------------------------------
# Modulo database: Aurora PostgreSQL Serverless v2.
# - Cluster + 1 instancia serverless (db.serverless).
# - Escalado automatico via serverlessv2_scaling_configuration (min/max ACU).
# - Credenciales generadas con random_password y guardadas en Secrets Manager
#   (NUNCA en texto plano en el state de variables).
# - Subnet group en subnets privadas; SG que solo acepta del SG de compute.
# - Parameter group con shared_preload_libraries para habilitar pg_trgm/unaccent
#   (la creacion de las EXTENSIONs propiamente se hace via migraciones SQL, pero
#   dejamos el parameter group listo y comentamos la decision).
# ---------------------------------------------------------------------------

# ---- Contraseña y secreto -------------------------------------------------
resource "random_password" "master" {
  length  = 32
  special = true
  # Se excluyen caracteres que complican las cadenas de conexion / URL.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db" {
  name        = "${var.name_prefix}-db-credentials"
  description = "Credenciales del cluster Aurora de ${var.name_prefix}"

  tags = {
    Name = "${var.name_prefix}-db-credentials"
  }
}

# El secreto guarda un JSON con todo lo necesario para construir DATABASE_URL.
# La app lee este secreto en runtime (ver modulos compute_api / ingestion).
resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id

  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    engine   = "postgres"
    host     = aws_rds_cluster.this.endpoint
    reader   = aws_rds_cluster.this.reader_endpoint
    port     = aws_rds_cluster.this.port
    dbname   = var.db_name
  })
}

# ---- Red y seguridad ------------------------------------------------------
resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.name_prefix}-db-subnets"
  }
}

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db-sg"
  description = "Aurora: entrada 5432 solo desde SGs de compute autorizados"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-db-sg"
  }
}

# Una regla de ingress por cada SG autorizado (API, workers). Menor privilegio:
# la BD nunca acepta trafico de rangos CIDR abiertos.
resource "aws_security_group_rule" "db_ingress" {
  count                    = length(var.allowed_security_group_ids)
  type                     = "ingress"
  description              = "PostgreSQL desde compute autorizado"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db.id
  source_security_group_id = var.allowed_security_group_ids[count.index]
}

# ---- Parameter group ------------------------------------------------------
# Familia derivada de la version mayor del engine (aurora-postgresql16, etc.).
locals {
  engine_major        = split(".", var.engine_version)[0]
  parameter_group_fam = "aurora-postgresql${local.engine_major}"
}

# Las extensiones pg_trgm, unaccent y uuid-ossp NO requieren precarga en
# shared_preload_libraries; se instalan con CREATE EXTENSION en las migraciones.
# Dejamos el parameter group para poder afinar parametros si hiciera falta.
resource "aws_rds_cluster_parameter_group" "this" {
  name        = "${var.name_prefix}-aurora-pg"
  family      = local.parameter_group_fam
  description = "Cluster parameter group para ${var.name_prefix}"

  # Fuerza SSL en las conexiones a la BD.
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name = "${var.name_prefix}-aurora-pg"
  }
}

# ---- Cluster --------------------------------------------------------------
resource "aws_rds_cluster" "this" {
  cluster_identifier = "${var.name_prefix}-aurora"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned" # Serverless v2 usa engine_mode "provisioned".
  engine_version     = var.engine_version
  database_name      = var.db_name

  master_username = var.master_username
  master_password = random_password.master.result

  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.db.id]
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.this.name

  storage_encrypted   = true
  deletion_protection = var.deletion_protection

  backup_retention_period = var.backup_retention_days
  preferred_backup_window = "05:00-06:00"

  # Escalado de Serverless v2. min 0.5 (o 0 para auto-pausa en versiones nuevas).
  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity_acu
    max_capacity = var.max_capacity_acu
  }

  # En dev evitamos snapshot final; en prod deberia tomarse.
  skip_final_snapshot       = !var.deletion_protection
  final_snapshot_identifier = var.deletion_protection ? "${var.name_prefix}-aurora-final" : null

  # El engine_version puede cambiar por mantenimiento gestionado por AWS.
  lifecycle {
    ignore_changes = [engine_version]
  }

  tags = {
    Name = "${var.name_prefix}-aurora"
  }
}

# ---- Instancia serverless -------------------------------------------------
# Una instancia writer serverless. Para lecturas del dataset publico se pueden
# agregar mas instancias (readers) escalando este count en el futuro.
resource "aws_rds_cluster_instance" "this" {
  identifier           = "${var.name_prefix}-aurora-1"
  cluster_identifier   = aws_rds_cluster.this.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.this.engine
  engine_version       = aws_rds_cluster.this.engine_version
  db_subnet_group_name = aws_db_subnet_group.this.name

  # No exponer la instancia con IP publica.
  publicly_accessible = false

  tags = {
    Name = "${var.name_prefix}-aurora-1"
  }
}
