/**
 * Production environment — root module
 *
 * Provisions the production RDS read replica using the shared rds-replica module.
 *
 * Run from this directory:
 *   terraform init
 *   terraform plan -var-file="production.tfvars"
 *   terraform apply -var-file="production.tfvars"
 */

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }

  backend "s3" {
    bucket         = "aura-vault-terraform-state"
    key            = "envs/production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "aura-vault-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------------------------
# Data sources — reference the primary RDS instance from root state
# ---------------------------------------------------------------------------
data "terraform_remote_state" "root" {
  backend = "s3"
  config = {
    bucket = "aura-vault-terraform-state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}

# ---------------------------------------------------------------------------
# RDS Read Replica — Production
# ---------------------------------------------------------------------------
module "rds_replica" {
  source = "../../modules/rds-replica"

  primary_instance_id = "aura-vault-db-prod"
  instance_class      = var.replica_instance_class
  availability_zone   = var.replica_availability_zone
  environment         = "prod"

  monitoring_role_arn          = data.terraform_remote_state.root.outputs.rds_monitoring_role_arn
  performance_insights_enabled = true

  extra_tags = {
    CostCenter     = "platform"
    Criticality    = "high"
    BackupPolicy   = "managed-by-primary"
  }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------
output "replica_endpoint" {
  description = "Production read-replica endpoint (host:port) — wire into DATABASE_REPLICA_URL."
  value       = module.rds_replica.replica_endpoint
  sensitive   = true
}

output "replica_arn" {
  description = "ARN of the production read replica."
  value       = module.rds_replica.replica_arn
}
