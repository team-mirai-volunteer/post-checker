# =============================================================================
# Service Account
# =============================================================================

resource "google_service_account" "dify_vm" {
  account_id   = "${local.name_prefix}-vm-${local.name_suffix}"
  display_name = "Dify VM Service Account"
}

# GCS access for Dify storage
resource "google_storage_bucket_iam_member" "vm_storage_admin" {
  bucket = google_storage_bucket.dify_storage.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.dify_vm.email}"
}

# Cloud SQL access
resource "google_project_iam_member" "vm_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.dify_vm.email}"
}

# =============================================================================
# Static IP
# =============================================================================

resource "google_compute_address" "dify_static_ip" {
  name   = "${local.name_prefix}-ip-${local.name_suffix}"
  region = var.region
}

# =============================================================================
# VM Instance
# =============================================================================

resource "google_compute_instance" "dify" {
  name         = "${local.name_prefix}-vm-${local.name_suffix}"
  machine_type = var.vm_machine_type
  zone         = "${var.region}-b"

  tags = ["dify-vm"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.vm_disk_size
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id

    access_config {
      nat_ip = google_compute_address.dify_static_ip.address
    }
  }

  service_account {
    email  = google_service_account.dify_vm.email
    scopes = ["cloud-platform"]
  }

  # Install Docker and setup Dify
  metadata_startup_script = templatefile("${path.module}/scripts/startup.sh", {
    dify_version       = var.dify_version
    db_host            = google_sql_database_instance.main.private_ip_address
    db_port            = "5432"
    db_user            = var.db_user
    db_password        = random_password.db_password.result
    db_name            = var.db_name
    storage_bucket     = google_storage_bucket.dify_storage.name
    secret_key         = var.secret_key
    init_password      = var.init_password
  })

  depends_on = [
    google_project_service.apis,
    google_sql_database_instance.main,
    google_storage_bucket.dify_storage,
  ]
}
