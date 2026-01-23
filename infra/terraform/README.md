# Terraform Infrastructure

Dify を Google Cloud にデプロイするための Terraform 設定。

## 必要なもの

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.0
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- GCP プロジェクト（課金有効化済み）

## セットアップ

### 1. GCP 認証

```bash
gcloud auth application-default login
```

### 2. 環境変数の設定

```bash
cd infra/terraform
cp .env.example .env
```

`.env` を編集して値を設定：

```bash
# GCP Project Configuration
TF_VAR_PROJECT_ID=your-gcp-project-id

# Secrets (required)
# Generate secret_key with: openssl rand -hex 32
TF_VAR_SECRET_KEY=your-secret-key
TF_VAR_INIT_PASSWORD=your-admin-password
```

| 変数 | 説明 |
|------|------|
| `TF_VAR_PROJECT_ID` | GCP プロジェクト ID |
| `TF_VAR_SECRET_KEY` | Dify の暗号化キー（`openssl rand -hex 32` で生成） |
| `TF_VAR_INIT_PASSWORD` | Dify 管理者の初期パスワード |

### 3. デプロイ

```bash
./deploy.sh
```

`deploy.sh` は以下を実行します：
1. `.env` から環境変数を読み込み
2. `terraform.tfvars.template` から `terraform.tfvars` を生成
3. `terraform init` と `terraform apply` を実行

### 4. 確認

デプロイ完了後、以下の URL でアクセス：
- Web: https://post-checker.team-mir.ai
- API: https://post-checker-api.team-mir.ai

## その他のコマンド

```bash
# プランのみ確認（適用しない）
./deploy.sh -auto-approve=false

# 特定リソースのみ適用
./deploy.sh -target=google_cloud_run_v2_service.api

# 削除（注意：全リソースが削除されます）
source .env
envsubst < terraform.tfvars.template > terraform.tfvars
terraform destroy
```

## 構成

| ファイル | 内容 |
|----------|------|
| `main.tf` | プロバイダ設定、ローカル変数 |
| `variables.tf` | 入力変数定義 |
| `cloudrun.tf` | Cloud Run サービス（API, Web, Plugin Daemon） |
| `database.tf` | Cloud SQL PostgreSQL |
| `redis.tf` | Memorystore Redis |
| `network.tf` | VPC, NAT, VPC Connector |
| `storage.tf` | GCS バケット |
| `secrets.tf` | Secret Manager |
| `outputs.tf` | 出力値 |
