# ---------------------------------------------------------------------------
# Modulo networking: VPC con subnets publicas y privadas en N AZ, IGW,
# NAT Gateway(s), tablas de rutas y security groups base.
#
# Diseno de subnetting: se derivan dinamicamente subredes /20 a partir del CIDR
# de la VPC usando cidrsubnet(). Las publicas ocupan los primeros indices y las
# privadas indices desplazados, evitando solapamientos.
# ---------------------------------------------------------------------------

# Data source para descubrir las AZ disponibles en la region (no hardcodear).
data "aws_availability_zones" "available" {
  state = "available"

  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # Con una VPC /16, cidrsubnet(cidr, 4, i) produce bloques /20.
  # Publicas: indices 0..az_count-1. Privadas: indices az_count..2*az_count-1.
  public_subnet_cidrs  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnet_cidrs = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i + var.az_count)]

  # Cantidad de NAT Gateways: 1 (dev) o uno por AZ (prod).
  nat_gateway_count = var.single_nat_gateway ? 1 : var.az_count
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.name_prefix}-igw"
  }
}

# ---- Subnets publicas -----------------------------------------------------
resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.this.id
  cidr_block              = local.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.name_prefix}-public-${local.azs[count.index]}"
    Tier = "public"
  }
}

# ---- Subnets privadas -----------------------------------------------------
resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = local.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${var.name_prefix}-private-${local.azs[count.index]}"
    Tier = "private"
  }
}

# ---- NAT Gateway(s) -------------------------------------------------------
# Los recursos privados (ECS, Aurora conexiones salientes, workers) acceden a
# internet (Nexus PJ, endpoints AWS) a traves del NAT. En dev un solo NAT
# reduce costo; en prod uno por AZ evita punto unico de fallo.
resource "aws_eip" "nat" {
  count  = local.nat_gateway_count
  domain = "vpc"

  tags = {
    Name = "${var.name_prefix}-nat-eip-${count.index}"
  }
}

resource "aws_nat_gateway" "this" {
  count         = local.nat_gateway_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.name_prefix}-nat-${count.index}"
  }

  depends_on = [aws_internet_gateway.this]
}

# ---- Tablas de rutas ------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = {
    Name = "${var.name_prefix}-rt-public"
  }
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Una tabla de rutas privada por AZ: cada subnet privada enruta hacia el NAT
# de su AZ (o al unico NAT si single_nat_gateway).
resource "aws_route_table" "private" {
  count  = var.az_count
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[var.single_nat_gateway ? 0 : count.index].id
  }

  tags = {
    Name = "${var.name_prefix}-rt-private-${local.azs[count.index]}"
  }
}

resource "aws_route_table_association" "private" {
  count          = var.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ---- VPC Endpoints (Gateway) ---------------------------------------------
# Endpoint S3 tipo Gateway: el trafico a S3 (subida/descarga de PDFs) no pasa
# por el NAT, reduciendo costo y latencia. Se asocia a las tablas privadas.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id

  tags = {
    Name = "${var.name_prefix}-vpce-s3"
  }
}

data "aws_region" "current" {}

# ---- Security Groups base -------------------------------------------------

# SG para el ALB: acepta HTTP/HTTPS desde internet.
resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "ALB publico: entrada HTTP/HTTPS desde internet"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Salida a todos"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-alb-sg"
  }
}

# SG para las tareas de la API: solo acepta trafico del ALB en el puerto de la app.
resource "aws_security_group" "api" {
  name        = "${var.name_prefix}-api-sg"
  description = "Tareas ECS de la API: entrada solo desde el ALB"
  vpc_id      = aws_vpc.this.id

  egress {
    description = "Salida a todos (BD, SQS, SNS, SES, Cognito)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-api-sg"
  }
}

# Regla separada para evitar ciclo de dependencia SG-a-SG.
resource "aws_security_group_rule" "api_from_alb" {
  type                     = "ingress"
  description              = "Trafico de la app desde el ALB"
  from_port                = 0
  to_port                  = 65535
  protocol                 = "tcp"
  security_group_id        = aws_security_group.api.id
  source_security_group_id = aws_security_group.alb.id
}

# SG para los workers de ingesta/parsing: sin ingress (no reciben conexiones),
# solo salida (S3, SQS, Textract, BD).
resource "aws_security_group" "workers" {
  name        = "${var.name_prefix}-workers-sg"
  description = "Workers de ingesta/parsing: solo salida"
  vpc_id      = aws_vpc.this.id

  egress {
    description = "Salida a todos"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-workers-sg"
  }
}
