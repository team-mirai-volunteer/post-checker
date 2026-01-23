# Cloud SQL PostgreSQL Instance
resource "google_sql_database_instance" "main" {
  name             = "${local.name_prefix}-db-${local.name_suffix}"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = false
      backup_retention_settings {
        retained_backups = 7
      }
    }
  }

  deletion_protection = false

  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.required_apis
  ]
}

# PostgreSQL Database
resource "google_sql_database" "dify" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

# PostgreSQL Database for Plugin Daemon
resource "google_sql_database" "dify_plugin" {
  name     = "dify_plugin"
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

# Generate random password for database
resource "random_password" "db_password" {
  length  = 32
  special = false
}

# PostgreSQL User
resource "google_sql_user" "dify" {
  name     = var.db_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
  project  = var.project_id
}

# Store database password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${local.name_prefix}-db-password-${local.name_suffix}"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}
