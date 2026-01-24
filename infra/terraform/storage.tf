# =============================================================================
# GCS Bucket for Dify Storage
# =============================================================================

resource "google_storage_bucket" "dify_storage" {
  name     = "${var.project_id}-dify-storage-${local.name_suffix}"
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = true
}
