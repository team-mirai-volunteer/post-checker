# =============================================================================
# Cloud SQL Instance
# =============================================================================

resource "google_sql_database_instance" "main" {
  name             = "${local.name_prefix}-db-${local.name_suffix}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
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

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# =============================================================================
# Databases
# =============================================================================

resource "google_sql_database" "dify" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_database" "dify_plugin" {
  name     = "${var.db_name}_plugin"
  instance = google_sql_database_instance.main.name
}

# =============================================================================
# Database User
# =============================================================================

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "google_sql_user" "dify" {
  name     = var.db_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}
