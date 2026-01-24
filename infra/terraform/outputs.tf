# =============================================================================
# VM Outputs
# =============================================================================

output "vm_static_ip" {
  description = "Static IP address for the VM (internal use)"
  value       = google_compute_address.dify_static_ip.address
}

output "lb_ip" {
  description = "Load Balancer IP address (set this in Vercel Domains)"
  value       = google_compute_global_address.lb_ip.address
}

output "vm_name" {
  description = "VM instance name"
  value       = google_compute_instance.dify.name
}

output "vm_zone" {
  description = "VM zone"
  value       = google_compute_instance.dify.zone
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "gcloud compute ssh ${google_compute_instance.dify.name} --zone=${google_compute_instance.dify.zone} --tunnel-through-iap"
}

# =============================================================================
# Database Outputs
# =============================================================================

output "database_private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.main.private_ip_address
}

output "database_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "db_password" {
  description = "Database password"
  value       = random_password.db_password.result
  sensitive   = true
}

# =============================================================================
# Storage Outputs
# =============================================================================

output "storage_bucket" {
  description = "GCS bucket name for Dify storage"
  value       = google_storage_bucket.dify_storage.name
}

# =============================================================================
# Dify Configuration Outputs
# =============================================================================

output "dify_env_config" {
  description = "Environment variables to set in Dify .env file"
  value       = <<-EOT
    # Database (Cloud SQL)
    DB_HOST=${google_sql_database_instance.main.private_ip_address}
    DB_PORT=5432
    DB_USERNAME=${var.db_user}
    DB_PASSWORD=<run: terraform output -raw db_password>
    DB_DATABASE=${var.db_name}

    # Vector Store (pgvector on Cloud SQL)
    VECTOR_STORE=pgvector
    PGVECTOR_HOST=${google_sql_database_instance.main.private_ip_address}
    PGVECTOR_PORT=5432
    PGVECTOR_USER=${var.db_user}
    PGVECTOR_PASSWORD=<run: terraform output -raw db_password>
    PGVECTOR_DATABASE=${var.db_name}

    # Storage (GCS)
    STORAGE_TYPE=google-storage
    GOOGLE_STORAGE_BUCKET_NAME=${google_storage_bucket.dify_storage.name}
  EOT
}
