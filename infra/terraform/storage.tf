# GCS Bucket for Dify storage (files, RSA keys, etc.)
resource "google_storage_bucket" "dify_storage" {
  name          = "${local.name_prefix}-storage-${local.name_suffix}"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = false
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}

# Grant Storage Admin access to Dify service account
resource "google_storage_bucket_iam_member" "dify_storage_admin" {
  bucket = google_storage_bucket.dify_storage.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.dify.email}"
}
