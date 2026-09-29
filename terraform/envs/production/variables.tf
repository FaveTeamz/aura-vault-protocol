variable "aws_region" {
  description = "AWS region for the production environment."
  type        = string
  default     = "us-east-1"
}

variable "replica_instance_class" {
  description = "RDS instance class for the production read replica. Use a larger class than staging."
  type        = string
  default     = "db.r6g.large"
}

variable "replica_availability_zone" {
  description = "Availability zone for the production read replica. Should differ from the primary AZ."
  type        = string
  default     = "us-east-1c"
}
