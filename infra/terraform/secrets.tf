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
