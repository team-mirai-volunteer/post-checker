# =============================================================================
# Load Balancer for HTTPS with Google-managed SSL
# =============================================================================

# Global static IP for Load Balancer
resource "google_compute_global_address" "lb_ip" {
  name = "${local.name_prefix}-lb-ip-${local.name_suffix}"
}

# Google-managed SSL certificate
resource "google_compute_managed_ssl_certificate" "default" {
  name = "${local.name_prefix}-ssl-${local.name_suffix}"

  managed {
    domains = [var.domain]
  }
}

# Health check (TCP because Dify returns 307 redirect on /)
resource "google_compute_health_check" "default" {
  name               = "${local.name_prefix}-health-${local.name_suffix}"
  check_interval_sec = 10
  timeout_sec        = 5

  tcp_health_check {
    port = 80
  }
}

# Instance group (unmanaged)
resource "google_compute_instance_group" "dify" {
  name      = "${local.name_prefix}-ig-${local.name_suffix}"
  zone      = "${var.region}-b"
  instances = [google_compute_instance.dify.id]

  named_port {
    name = "http"
    port = 80
  }
}

# Backend service
resource "google_compute_backend_service" "default" {
  name                  = "${local.name_prefix}-backend-${local.name_suffix}"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  health_checks         = [google_compute_health_check.default.id]
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group           = google_compute_instance_group.dify.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }
}

# URL map
resource "google_compute_url_map" "default" {
  name            = "${local.name_prefix}-urlmap-${local.name_suffix}"
  default_service = google_compute_backend_service.default.id
}

# HTTPS proxy
resource "google_compute_target_https_proxy" "default" {
  name             = "${local.name_prefix}-https-proxy-${local.name_suffix}"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
}

# HTTPS forwarding rule
resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${local.name_prefix}-https-fwd-${local.name_suffix}"
  ip_address            = google_compute_global_address.lb_ip.id
  port_range            = "443"
  target                = google_compute_target_https_proxy.default.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# HTTP to HTTPS redirect
resource "google_compute_url_map" "http_redirect" {
  name = "${local.name_prefix}-http-redirect-${local.name_suffix}"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_redirect" {
  name    = "${local.name_prefix}-http-proxy-${local.name_suffix}"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  name                  = "${local.name_prefix}-http-fwd-${local.name_suffix}"
  ip_address            = google_compute_global_address.lb_ip.id
  port_range            = "80"
  target                = google_compute_target_http_proxy.http_redirect.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
