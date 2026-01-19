# Service Account for Cloud Run
resource "google_service_account" "dify" {
  account_id   = "${local.name_prefix}-sa-${local.name_suffix}"
  display_name = "Dify Cloud Run Service Account"
  project      = var.project_id
}

# Grant Secret Manager access to service account
resource "google_secret_manager_secret_iam_member" "db_password_access" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.dify.email}"
  project   = var.project_id
}

resource "google_secret_manager_secret_iam_member" "secret_key_access" {
  secret_id = google_secret_manager_secret.secret_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.dify.email}"
  project   = var.project_id
}

resource "google_secret_manager_secret_iam_member" "init_password_access" {
  secret_id = google_secret_manager_secret.init_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.dify.email}"
  project   = var.project_id
}

# Grant Cloud SQL Client role
resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.dify.email}"
}

# Dify API Service
resource "google_cloud_run_v2_service" "api" {
  name     = "${local.name_prefix}-api-${local.name_suffix}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.dify.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = "langgenius/dify-api:${var.dify_version}"

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      ports {
        container_port = 5001
      }

      env {
        name  = "MODE"
        value = "api"
      }

      env {
        name  = "LOG_LEVEL"
        value = "INFO"
      }

      env {
        name  = "CONSOLE_WEB_URL"
        value = ""
      }

      env {
        name  = "CONSOLE_API_URL"
        value = ""
      }

      env {
        name  = "SERVICE_API_URL"
        value = ""
      }

      env {
        name  = "APP_WEB_URL"
        value = ""
      }

      env {
        name  = "FILES_URL"
        value = ""
      }

      env {
        name = "SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secret_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "INIT_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.init_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "DB_USERNAME"
        value = var.db_user
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.main.private_ip_address
      }

      env {
        name  = "DB_PORT"
        value = "5432"
      }

      env {
        name  = "DB_DATABASE"
        value = var.db_name
      }

      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.main.host
      }

      env {
        name  = "REDIS_PORT"
        value = tostring(google_redis_instance.main.port)
      }

      env {
        name  = "REDIS_DB"
        value = "0"
      }

      env {
        name  = "CELERY_BROKER_URL"
        value = "redis://${google_redis_instance.main.host}:${google_redis_instance.main.port}/1"
      }

      env {
        name  = "STORAGE_TYPE"
        value = "local"
      }

      env {
        name  = "STORAGE_LOCAL_PATH"
        value = "/app/api/storage"
      }

      env {
        name  = "VECTOR_STORE"
        value = "pgvector"
      }

      env {
        name  = "PGVECTOR_HOST"
        value = google_sql_database_instance.main.private_ip_address
      }

      env {
        name  = "PGVECTOR_PORT"
        value = "5432"
      }

      env {
        name  = "PGVECTOR_USER"
        value = var.db_user
      }

      env {
        name = "PGVECTOR_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "PGVECTOR_DATABASE"
        value = var.db_name
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_iam_member.db_password_access,
    google_secret_manager_secret_iam_member.secret_key_access,
    google_secret_manager_secret_iam_member.init_password_access,
    google_project_iam_member.cloudsql_client,
    google_sql_database.dify,
    google_sql_user.dify,
  ]
}

# Dify Worker Service
resource "google_cloud_run_v2_service" "worker" {
  name     = "${local.name_prefix}-worker-${local.name_suffix}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.dify.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = "langgenius/dify-api:${var.dify_version}"

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      env {
        name  = "MODE"
        value = "worker"
      }

      env {
        name  = "LOG_LEVEL"
        value = "INFO"
      }

      env {
        name = "SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secret_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "DB_USERNAME"
        value = var.db_user
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.main.private_ip_address
      }

      env {
        name  = "DB_PORT"
        value = "5432"
      }

      env {
        name  = "DB_DATABASE"
        value = var.db_name
      }

      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.main.host
      }

      env {
        name  = "REDIS_PORT"
        value = tostring(google_redis_instance.main.port)
      }

      env {
        name  = "REDIS_DB"
        value = "0"
      }

      env {
        name  = "CELERY_BROKER_URL"
        value = "redis://${google_redis_instance.main.host}:${google_redis_instance.main.port}/1"
      }

      env {
        name  = "STORAGE_TYPE"
        value = "local"
      }

      env {
        name  = "STORAGE_LOCAL_PATH"
        value = "/app/api/storage"
      }

      env {
        name  = "VECTOR_STORE"
        value = "pgvector"
      }

      env {
        name  = "PGVECTOR_HOST"
        value = google_sql_database_instance.main.private_ip_address
      }

      env {
        name  = "PGVECTOR_PORT"
        value = "5432"
      }

      env {
        name  = "PGVECTOR_USER"
        value = var.db_user
      }

      env {
        name = "PGVECTOR_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "PGVECTOR_DATABASE"
        value = var.db_name
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_iam_member.db_password_access,
    google_secret_manager_secret_iam_member.secret_key_access,
    google_project_iam_member.cloudsql_client,
    google_sql_database.dify,
    google_sql_user.dify,
  ]
}

# Dify Web Service
resource "google_cloud_run_v2_service" "web" {
  name     = "${local.name_prefix}-web-${local.name_suffix}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.dify.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = "langgenius/dify-web:${var.dify_version}"

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      ports {
        container_port = 3000
      }

      env {
        name  = "CONSOLE_API_URL"
        value = ""
      }

      env {
        name  = "APP_API_URL"
        value = ""
      }
    }
  }
}

# Allow unauthenticated access to web service
resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow unauthenticated access to API service
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
