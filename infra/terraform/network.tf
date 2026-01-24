# =============================================================================
# VPC Network
# =============================================================================

resource "google_compute_network" "main" {
  name                    = "${local.name_prefix}-vpc-${local.name_suffix}"
  auto_create_subnetworks = false

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "main" {
  name          = "${local.name_prefix}-subnet-${local.name_suffix}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}

# =============================================================================
# Cloud NAT (for outbound internet access from VM)
# =============================================================================

resource "google_compute_router" "main" {
  name    = "${local.name_prefix}-router-${local.name_suffix}"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "${local.name_prefix}-nat-${local.name_suffix}"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# =============================================================================
# Private Service Access (for Cloud SQL)
# =============================================================================

resource "google_compute_global_address" "private_ip_range" {
  name          = "${local.name_prefix}-private-ip-${local.name_suffix}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]

  depends_on = [google_project_service.apis]
}

# =============================================================================
# Firewall Rules
# =============================================================================

resource "google_compute_firewall" "allow_http_https" {
  name    = "${local.name_prefix}-allow-http-https-${local.name_suffix}"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["dify-vm"]
}

resource "google_compute_firewall" "allow_ssh_iap" {
  name    = "${local.name_prefix}-allow-ssh-iap-${local.name_suffix}"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # IAP's IP range
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["dify-vm"]
}
