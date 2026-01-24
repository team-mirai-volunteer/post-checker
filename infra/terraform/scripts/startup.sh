#!/bin/bash
set -e

DIFY_DIR="/opt/dify"
LOG_FILE="/var/log/dify-setup.log"

exec > >(tee -a "$LOG_FILE") 2>&1
echo "=== Dify setup started at $(date) ==="

# =============================================================================
# Skip if already setup
# =============================================================================
if [ -f "$DIFY_DIR/docker/.env" ] && docker ps | grep -q dify; then
  echo "Dify already running, skipping setup"
  exit 0
fi

# =============================================================================
# Install Docker
# =============================================================================
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  usermod -aG docker ubuntu
  echo "Docker installed"
else
  echo "Docker already installed"
fi

# =============================================================================
# Clone Dify
# =============================================================================
if [ ! -d "$DIFY_DIR" ]; then
  echo "Cloning Dify ${dify_version}..."
  git clone https://github.com/langgenius/dify.git "$DIFY_DIR"
  cd "$DIFY_DIR"
  git checkout "${dify_version}"
else
  echo "Dify directory exists"
fi

cd "$DIFY_DIR/docker"

# =============================================================================
# Create .env (skip if already exists to preserve keys)
# =============================================================================
if [ ! -f .env ]; then
  echo "Creating .env..."
  cp .env.example .env

  # Generate random keys for plugin daemon
  PLUGIN_DAEMON_KEY=$(openssl rand -hex 32)
  INNER_API_KEY=$(openssl rand -hex 32)

  # Update .env with our settings
  cat >> .env << 'ENVEOF'

# =============================================================================
# Cloud SQL Database (managed by Terraform)
# =============================================================================
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_USERNAME=${db_user}
DB_PASSWORD=${db_password}
DB_DATABASE=${db_name}

# =============================================================================
# Vector Store (pgvector on Cloud SQL)
# =============================================================================
VECTOR_STORE=pgvector
PGVECTOR_HOST=${db_host}
PGVECTOR_PORT=${db_port}
PGVECTOR_USER=${db_user}
PGVECTOR_PASSWORD=${db_password}
PGVECTOR_DATABASE=${db_name}

# =============================================================================
# GCS Storage (managed by Terraform)
# =============================================================================
STORAGE_TYPE=google-storage
GOOGLE_STORAGE_BUCKET_NAME=${storage_bucket}

# =============================================================================
# Dify Settings
# =============================================================================
SECRET_KEY=${secret_key}
INIT_PASSWORD=${init_password}
ENVEOF

  # Add generated keys
  echo "PLUGIN_DAEMON_KEY=$PLUGIN_DAEMON_KEY" >> .env
  echo "INNER_API_KEY=$INNER_API_KEY" >> .env
else
  echo ".env already exists; skipping regeneration"
fi

# =============================================================================
# Create docker-compose.override.yml to disable local postgres
# =============================================================================
echo "Creating docker-compose.override.yml..."
cat > docker-compose.override.yml << 'YAMLEOF'
services:
  db:
    profiles:
      - disabled
  api:
    depends_on:
      redis:
        condition: service_healthy
      sandbox:
        condition: service_started
  worker:
    depends_on:
      redis:
        condition: service_healthy
YAMLEOF

# =============================================================================
# Start Dify
# =============================================================================
echo "Starting Dify..."
docker compose up -d

echo "=== Dify setup completed at $(date) ==="
echo "Access Dify at http://$(curl -s ifconfig.me)"
