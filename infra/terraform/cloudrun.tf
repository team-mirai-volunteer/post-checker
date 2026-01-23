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

resource "google_secret_manager_secret_iam_member" "plugin_daemon_key_access" {
  secret_id = google_secret_manager_secret.plugin_daemon_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.dify.email}"
  project   = var.project_id
}

resource "google_secret_manager_secret_iam_member" "inner_api_key_access" {
  secret_id = google_secret_manager_secret.inner_api_key.id
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
        name  = "MIGRATION_ENABLED"
        value = "true"
      }

      # Note: URL values left empty - Dify auto-detects from request headers
      # CORS is set to allow all origins for Cloud Run multi-service setup
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
        name  = "CONSOLE_CORS_ALLOW_ORIGINS"
        value = "*"
      }

      env {
        name  = "WEB_API_CORS_ALLOW_ORIGINS"
        value = "*"
      }

      # Cookie settings for cross-domain authentication
      env {
        name  = "COOKIE_HTTPONLY"
        value = "true"
      }

      env {
        name  = "COOKIE_SAMESITE"
        value = "Lax"
      }

      env {
        name  = "COOKIE_SECURE"
        value = "true"
      }

      env {
        name  = "COOKIE_DOMAIN"
        value = ".team-mir.ai"
      }

      # Token expiration settings
      env {
        name  = "ACCESS_TOKEN_EXPIRE_MINUTES"
        value = "60"
      }

      env {
        name  = "REFRESH_TOKEN_EXPIRE_DAYS"
        value = "30"
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

      # INIT_PASSWORD removed - not needed after initial setup
      # env {
      #   name = "INIT_PASSWORD"
      #   value_source {
      #     secret_key_ref {
      #       secret  = google_secret_manager_secret.init_password.secret_id
      #       version = "latest"
      #     }
      #   }
      # }

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
        value = "google-storage"
      }

      env {
        name  = "GOOGLE_STORAGE_BUCKET_NAME"
        value = google_storage_bucket.dify_storage.name
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

      # Plugin Daemon Configuration
      # Note: Using the Cloud Run service URL. The plugin_daemon service must be created first.
      env {
        name  = "PLUGIN_DAEMON_URL"
        value = google_cloud_run_v2_service.plugin_daemon.uri
      }

      env {
        name = "PLUGIN_DAEMON_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.plugin_daemon_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "INNER_API_KEY_FOR_PLUGIN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.inner_api_key.secret_id
            version = "latest"
          }
        }
      }

      # Marketplace Configuration
      env {
        name  = "MARKETPLACE_ENABLED"
        value = "true"
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_iam_member.db_password_access,
    google_secret_manager_secret_iam_member.secret_key_access,
    google_secret_manager_secret_iam_member.init_password_access,
    google_secret_manager_secret_iam_member.plugin_daemon_key_access,
    google_secret_manager_secret_iam_member.inner_api_key_access,
    google_project_iam_member.cloudsql_client,
    google_sql_database.dify,
    google_sql_user.dify,
    google_cloud_run_v2_service.plugin_daemon,
    google_storage_bucket_iam_member.dify_storage_admin,
  ]
}

# Dify Worker Service - DISABLED (Cloud Run doesn't support non-HTTP workers well)
# Consider using Cloud Run Worker Pools or GCE for Celery workers in the future
# resource "google_cloud_run_v2_service" "worker" {
#   ... (disabled)
# }

# Dify Plugin Daemon Service
resource "google_cloud_run_v2_service" "plugin_daemon" {
  name     = "${local.name_prefix}-plugin-daemon-${local.name_suffix}"
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
      image = "langgenius/dify-plugin-daemon:0.5.2-local"

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      ports {
        container_port = 5002
      }

      # Server Configuration
      env {
        name  = "SERVER_PORT"
        value = "5002"
      }

      env {
        name = "SERVER_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.plugin_daemon_key.secret_id
            version = "latest"
          }
        }
      }

      # Database Configuration
      env {
        name  = "DB_TYPE"
        value = "postgresql"
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
        value = "dify_plugin"
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
        name  = "DB_SSL_MODE"
        value = "disable"
      }

      # Redis Configuration
      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.main.host
      }

      env {
        name  = "REDIS_PORT"
        value = tostring(google_redis_instance.main.port)
      }

      env {
        name  = "REDIS_PASSWORD"
        value = ""
      }

      # Dify Inner API Configuration
      env {
        name  = "DIFY_INNER_API_URL"
        value = "https://post-checker-api.team-mir.ai"
      }

      env {
        name = "DIFY_INNER_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.inner_api_key.secret_id
            version = "latest"
          }
        }
      }

      # Storage Configuration
      env {
        name  = "PLUGIN_STORAGE_TYPE"
        value = "local"
      }

      env {
        name  = "PLUGIN_STORAGE_LOCAL_ROOT"
        value = "/app/storage"
      }

      env {
        name  = "PLUGIN_WORKING_PATH"
        value = "/app/storage/cwd"
      }

      env {
        name  = "S3_USE_AWS"
        value = "false"
      }

      env {
        name  = "S3_USE_AWS_MANAGED_IAM"
        value = "false"
      }

      # Plugin Settings
      env {
        name  = "MAX_PLUGIN_PACKAGE_SIZE"
        value = "52428800"
      }

      env {
        name  = "PLUGIN_MAX_EXECUTION_TIMEOUT"
        value = "600"
      }

      env {
        name  = "FORCE_VERIFYING_SIGNATURE"
        value = "false"
      }

      env {
        name  = "ENFORCE_LANGGENIUS_PLUGIN_SIGNATURES"
        value = "false"
      }

      env {
        name  = "PIP_MIRROR_URL"
        value = ""
      }

      env {
        name  = "PYTHON_ENV_INIT_TIMEOUT"
        value = "120"
      }

      env {
        name  = "PLUGIN_STDIO_BUFFER_SIZE"
        value = "1024"
      }

      env {
        name  = "PLUGIN_STDIO_MAX_BUFFER_SIZE"
        value = "5242880"
      }

      # Plugin Remote Installing Configuration
      env {
        name  = "PLUGIN_REMOTE_INSTALLING_ENABLED"
        value = "false"
      }

      env {
        name  = "PLUGIN_REMOTE_INSTALLING_HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "PLUGIN_REMOTE_INSTALLING_PORT"
        value = "5003"
      }

      # Platform Configuration
      env {
        name  = "PLATFORM"
        value = "local"
      }

      # Persistence path
      env {
        name  = "PERSISTENCE_STORAGE_PATH"
        value = "/app/storage"
      }

      env {
        name  = "PLUGIN_INSTALLED_PATH"
        value = "plugin"
      }

      env {
        name  = "PLUGIN_PACKAGE_CACHE_PATH"
        value = "plugin_packages"
      }

      env {
        name  = "PLUGIN_MEDIA_CACHE_PATH"
        value = "assets"
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_iam_member.db_password_access,
    google_secret_manager_secret_iam_member.plugin_daemon_key_access,
    google_secret_manager_secret_iam_member.inner_api_key_access,
    google_project_iam_member.cloudsql_client,
    google_sql_database.dify_plugin,
  ]
}

# Allow API service to invoke Plugin Daemon (unauthenticated for internal communication)
resource "google_cloud_run_v2_service_iam_member" "plugin_daemon_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.plugin_daemon.name
  role     = "roles/run.invoker"
  member   = "allUsers"
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
        value = "https://post-checker-api.team-mir.ai"
      }

      env {
        name  = "APP_API_URL"
        value = "https://post-checker-api.team-mir.ai"
      }

      # Enable cookie domain sharing for cross-subdomain authentication
      env {
        name  = "NEXT_PUBLIC_COOKIE_DOMAIN"
        value = "1"
      }
    }
  }

  depends_on = [
    google_cloud_run_v2_service.api,
  ]
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

# Custom domain mapping for Web service
resource "google_cloud_run_domain_mapping" "web" {
  location = var.region
  name     = "post-checker.team-mir.ai"
  project  = var.project_id

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.web.name
  }
}

# Custom domain mapping for API service
resource "google_cloud_run_domain_mapping" "api" {
  location = var.region
  name     = "post-checker-api.team-mir.ai"
  project  = var.project_id

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.api.name
  }
}
