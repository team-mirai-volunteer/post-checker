# VPC Network for private connectivity
resource "google_compute_network" "main" {
  name                    = "${local.name_prefix}-vpc-${local.name_suffix}"
  auto_create_subnetworks = false
  project                 = var.project_id

  depends_on = [google_project_service.required_apis]
}

# Subnet for Cloud Run VPC connector
resource "google_compute_subnetwork" "main" {
  name          = "${local.name_prefix}-subnet-${local.name_suffix}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
  project       = var.project_id
}

# Private IP range for Cloud SQL
resource "google_compute_global_address" "private_ip_range" {
  name          = "${local.name_prefix}-private-ip-${local.name_suffix}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
  project       = var.project_id
}

# Private VPC connection for Cloud SQL
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]

  depends_on = [google_project_service.required_apis]
}

# VPC Access Connector for Cloud Run to access private resources
resource "google_vpc_access_connector" "connector" {
  name          = "${local.name_prefix}-conn-${local.name_suffix}"
  region        = var.region
  project       = var.project_id
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.main.name

  min_instances = 2
  max_instances = 3

  depends_on = [google_project_service.required_apis]
}

# Cloud Router for NAT
resource "google_compute_router" "main" {
  name    = "${local.name_prefix}-router-${local.name_suffix}"
  region  = var.region
  network = google_compute_network.main.id
  project = var.project_id
}

# Cloud NAT for outbound internet access from VPC
resource "google_compute_router_nat" "main" {
  name                               = "${local.name_prefix}-nat-${local.name_suffix}"
  router                             = google_compute_router.main.name
  region                             = var.region
  project                            = var.project_id
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
