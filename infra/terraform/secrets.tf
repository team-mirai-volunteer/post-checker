# Secret Key for Dify
resource "google_secret_manager_secret" "secret_key" {
  secret_id = "${local.name_prefix}-secret-key-${local.name_suffix}"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "secret_key" {
  secret      = google_secret_manager_secret.secret_key.id
  secret_data = var.secret_key
}

# Init Password for Dify
resource "google_secret_manager_secret" "init_password" {
  secret_id = "${local.name_prefix}-init-password-${local.name_suffix}"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "init_password" {
  secret      = google_secret_manager_secret.init_password.id
  secret_data = var.init_password
}

# Generate random key for Plugin Daemon communication
resource "random_password" "plugin_daemon_key" {
  length  = 64
  special = false
}

# Plugin Daemon Key
resource "google_secret_manager_secret" "plugin_daemon_key" {
  secret_id = "${local.name_prefix}-plugin-daemon-key-${local.name_suffix}"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "plugin_daemon_key" {
  secret      = google_secret_manager_secret.plugin_daemon_key.id
  secret_data = random_password.plugin_daemon_key.result
}

# Generate random key for Inner API communication
resource "random_password" "inner_api_key" {
  length  = 64
  special = false
}

# Inner API Key (for API <-> Plugin Daemon communication)
resource "google_secret_manager_secret" "inner_api_key" {
  secret_id = "${local.name_prefix}-inner-api-key-${local.name_suffix}"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "inner_api_key" {
  secret      = google_secret_manager_secret.inner_api_key.id
  secret_data = random_password.inner_api_key.result
}
