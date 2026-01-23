variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

# Cloud SQL Configuration
variable "db_tier" {
  description = "Cloud SQL instance tier (minimal for small-scale)"
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "dify"
}

variable "db_user" {
  description = "PostgreSQL database user"
  type        = string
  default     = "dify"
}

# Redis Configuration
variable "redis_memory_size_gb" {
  description = "Redis memory size in GB (minimal for small-scale)"
  type        = number
  default     = 1
}

variable "redis_tier" {
  description = "Redis tier (BASIC for minimal cost)"
  type        = string
  default     = "BASIC"
}

# Cloud Run Configuration
variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 2
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run services"
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run services"
  type        = string
  default     = "512Mi"
}

# Dify Configuration
variable "dify_version" {
  description = "Dify Docker image version"
  type        = string
  default     = "1.11.4"
}

variable "secret_key" {
  description = "Secret key for Dify application"
  type        = string
  sensitive   = true
}

variable "init_password" {
  description = "Initial admin password for Dify"
  type        = string
  sensitive   = true
}
