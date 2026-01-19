output "web_url" {
  description = "Dify Web UI URL"
  value       = google_cloud_run_v2_service.web.uri
}

output "api_url" {
  description = "Dify API URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "worker_url" {
  description = "Dify Worker URL"
  value       = google_cloud_run_v2_service.worker.uri
}

output "database_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "database_private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.main.private_ip_address
}

output "redis_host" {
  description = "Redis host address"
  value       = google_redis_instance.main.host
}

output "redis_port" {
  description = "Redis port"
  value       = google_redis_instance.main.port
}

output "vpc_connector_name" {
  description = "VPC Access Connector name"
  value       = google_vpc_access_connector.connector.name
}

output "service_account_email" {
  description = "Service account email for Cloud Run services"
  value       = google_service_account.dify.email
}
