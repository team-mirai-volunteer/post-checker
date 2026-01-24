#!/bin/bash
set -e

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found"
  echo "Copy .env.example to .env and fill in the values"
  exit 1
fi

# Generate tfvars from template
envsubst < terraform.tfvars.template > terraform.tfvars

# Run Terraform
terraform init
terraform apply
