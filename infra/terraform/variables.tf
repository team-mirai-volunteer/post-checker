# =============================================================================
# GCP Configuration
# =============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# =============================================================================
# VM Configuration
# =============================================================================

variable "vm_machine_type" {
  description = "GCE instance machine type"
  type        = string
  default     = "e2-standard-2"
}

variable "vm_disk_size" {
  description = "Boot disk size in GB"
  type        = number
  default     = 50
}

# =============================================================================
# Database Configuration
# =============================================================================

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "dify"
}

variable "db_user" {
  description = "Database user"
  type        = string
  default     = "dify"
}

# =============================================================================
# Dify Configuration
# =============================================================================

variable "dify_version" {
  description = "Dify version to deploy"
  type        = string
  default     = "1.11.4"
}

variable "secret_key" {
  description = "Dify secret key for encryption"
  type        = string
  sensitive   = true
}

variable "init_password" {
  description = "Dify admin initial password"
  type        = string
  sensitive   = true
}

# =============================================================================
# Domain Configuration
# =============================================================================

variable "domain" {
  description = "Domain for the application (e.g., postchecker.team-mir.ai)"
  type        = string
}
