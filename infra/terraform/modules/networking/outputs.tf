output "vpc_id" {
  description = "ID de la VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "CIDR de la VPC."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "IDs de las subnets publicas."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs de las subnets privadas."
  value       = aws_subnet.private[*].id
}

output "availability_zones" {
  description = "AZ usadas."
  value       = local.azs
}

output "alb_security_group_id" {
  description = "SG del ALB (publico)."
  value       = aws_security_group.alb.id
}

output "api_security_group_id" {
  description = "SG de las tareas de la API."
  value       = aws_security_group.api.id
}

output "workers_security_group_id" {
  description = "SG de los workers de ingesta/parsing."
  value       = aws_security_group.workers.id
}
