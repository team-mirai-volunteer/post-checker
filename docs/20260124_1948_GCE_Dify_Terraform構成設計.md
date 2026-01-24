# GCE + Dify Terraform構成設計

## 目的

開発者が Dify を GCP 上で安定してホスティングできるようにするため。

Cloud Run での構成が複雑すぎたため、GCE + Docker Compose によるシンプルな構成に移行する。

## 構成概要

```
┌─────────────────────────────────────────────────────────────┐
│ GCP Project                                                  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ VPC Network                                             │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────┐               │ │
│  │  │ GCE VM (e2-standard-2)              │               │ │
│  │  │                                     │               │ │
│  │  │  Docker Compose                     │               │ │
│  │  │  ├── nginx (80, 443)                │               │ │
│  │  │  ├── api                            │               │ │
│  │  │  ├── web                            │               │ │
│  │  │  ├── worker                         │               │ │
│  │  │  ├── redis                          │               │ │
│  │  │  ├── sandbox                        │               │ │
│  │  │  └── plugin_daemon                  │               │ │
│  │  │                                     │               │ │
│  │  └──────────────┬──────────────────────┘               │ │
│  │                 │ Private IP                           │ │
│  │                 ▼                                      │ │
│  │  ┌─────────────────────────────────────┐               │ │
│  │  │ Cloud SQL (PostgreSQL 15)           │               │ │
│  │  │  ├── dify                           │               │ │
│  │  │  └── dify_plugin                    │               │ │
│  │  └─────────────────────────────────────┘               │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────┐                    │
│  │ GCS Bucket                          │                    │
│  │  (Dify file storage)                │                    │
│  └─────────────────────────────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

外部:
  - Vercel Domains → GCE Static IP (Aレコード)
```

## Terraformファイル構成

```
infra/terraform/
├── main.tf                    # provider, 有効化するAPI
├── network.tf                 # VPC, Subnet, NAT, Firewall
├── database.tf                # Cloud SQL
├── storage.tf                 # GCS bucket
├── compute.tf                 # GCE VM, Static IP, Service Account
├── variables.tf               # 変数定義
├── outputs.tf                 # 出力（VM IP等）
├── .env.example               # 環境変数テンプレート
├── terraform.tfvars.template  # tfvars生成用テンプレート
└── deploy.sh                  # デプロイスクリプト
```

### 削除するファイル

- `cloudrun.tf.disabled`
- `redis.tf.disabled`
- `secrets.tf` （Secret Managerは使わない。.envで管理）
- `files/` ディレクトリ全体

## 各リソースの設計

### 1. main.tf

```hcl
# 有効化するAPI
- compute.googleapis.com
- sqladmin.googleapis.com
- servicenetworking.googleapis.com  # Cloud SQL Private IP用
```

### 2. network.tf

| リソース | 用途 |
|---------|------|
| VPC | カスタムVPC（auto_create_subnetworks = false） |
| Subnet | 10.0.0.0/24, asia-northeast1 |
| Cloud Router | NAT用 |
| Cloud NAT | VMからの外部アクセス用 |
| Private IP Range | Cloud SQLとのVPCピアリング用 |
| Firewall (HTTP/HTTPS) | 80, 443を許可 |
| Firewall (SSH) | IAP経由のSSH (35.235.240.0/20) |

### 3. database.tf

| 項目 | 値 |
|-----|-----|
| バージョン | PostgreSQL 15 |
| インスタンスタイプ | db-f1-micro（開発）/ db-custom-1-3840（本番） |
| ディスク | 10GB SSD |
| 接続 | Private IP only |
| データベース | `dify`, `dify_plugin` |
| ユーザー | `dify` (パスワードはランダム生成) |

### 4. storage.tf

| 項目 | 値 |
|-----|-----|
| バケット名 | `${project_id}-dify-storage` |
| ロケーション | asia-northeast1 |
| ライフサイクル | 365日で削除（任意） |
| アクセス | Uniform bucket-level access |

### 5. compute.tf

| 項目 | 値 |
|-----|-----|
| マシンタイプ | e2-standard-2 (2vCPU, 8GB RAM) |
| OS | Ubuntu 22.04 LTS |
| ディスク | 50GB pd-standard |
| Static IP | 作成してVMにアタッチ |
| Service Account | GCS読み書き権限, Cloud SQL Client権限 |

**startup-script**: Docker/Docker Composeのインストールのみ

### 6. variables.tf

| 変数 | 説明 | デフォルト |
|-----|------|----------|
| project_id | GCPプロジェクトID | (必須) |
| region | リージョン | asia-northeast1 |
| environment | 環境名 | dev |
| vm_machine_type | VMタイプ | e2-standard-2 |
| db_tier | Cloud SQLティア | db-f1-micro |
| dify_version | Difyバージョン | 1.11.4 |
| secret_key | Dify暗号化キー | (必須) |
| init_password | Dify管理者パスワード | (必須) |

### 7. outputs.tf

| 出力 | 説明 |
|-----|------|
| vm_static_ip | VMの固定IP（Vercel Domainsに設定） |
| vm_name | VMインスタンス名 |
| database_private_ip | Cloud SQLのPrivate IP |
| db_password | 生成されたDBパスワード（sensitive） |
| storage_bucket | GCSバケット名 |
| ssh_command | SSH接続コマンド例 |

## 環境変数管理

### .env.example

```bash
# GCP
TF_VAR_PROJECT_ID=your-gcp-project-id

# Dify
TF_VAR_SECRET_KEY=your-secret-key-here
TF_VAR_INIT_PASSWORD=your-admin-password
```

### terraform.tfvars.template

```hcl
project_id     = "${TF_VAR_PROJECT_ID}"
secret_key     = "${TF_VAR_SECRET_KEY}"
init_password  = "${TF_VAR_INIT_PASSWORD}"
```

### deploy.sh

```bash
#!/bin/bash
set -e

# .envを読み込み
source .env

# tfvarsを生成
envsubst < terraform.tfvars.template > terraform.tfvars

# Terraform実行
terraform init
terraform apply
```

## VMセットアップ手順（Terraform適用後の手動作業）

Terraformはインフラのみを作成する。Difyのセットアップは以下の手動手順で行う。

### 1. VMにSSH接続

```bash
gcloud compute ssh <vm-name> --zone=asia-northeast1-b --tunnel-through-iap
```

### 2. Difyをクローン

```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker
git checkout v1.11.4
```

### 3. .envを作成

```bash
cp .env.example .env
```

以下を編集:
```bash
# Database (Cloud SQL)
DB_HOST=<Cloud SQLのPrivate IP>
DB_PORT=5432
DB_USERNAME=dify
DB_PASSWORD=<terraform outputで確認>
DB_DATABASE=dify

# Storage (GCS)
STORAGE_TYPE=google-storage
GOOGLE_STORAGE_BUCKET_NAME=<terraform outputで確認>

# Vector Store (pgvector on Cloud SQL)
VECTOR_STORE=pgvector
PGVECTOR_HOST=<Cloud SQLのPrivate IP>
PGVECTOR_PORT=5432
PGVECTOR_USER=dify
PGVECTOR_PASSWORD=<同上>
PGVECTOR_DATABASE=dify

# Dify
SECRET_KEY=<.envで設定した値>
INIT_PASSWORD=<.envで設定した値>

# Plugin Daemon
PLUGIN_DAEMON_KEY=<任意の64文字>
INNER_API_KEY=<任意の64文字>
```

### 4. docker-compose起動

```bash
# PostgreSQLを除外して起動
docker compose --profile '' up -d
```

※ローカルのPostgreSQLコンテナは起動しない（Cloud SQLを使用）

### 5. 動作確認

```bash
curl http://localhost/health
```

## Vercel Domains設定

1. Vercel DashboardでカスタムドメインのDNS設定を開く
2. Aレコードを追加: `@ → <vm_static_ip>`
3. 反映を待つ（数分〜数時間）

## セキュリティ考慮事項

- Cloud SQLはPrivate IPのみ（外部からアクセス不可）
- SSH接続はIAP経由のみ
- Secret ManagerではなくVM内の.envでシークレット管理（シンプルさ優先）
- HTTPSはCloudflare等のCDN/Proxyで終端する想定

## 今後の検討事項（スコープ外）

- HTTPS証明書（Let's Encrypt / Cloudflare）
- バックアップ・リストア手順
- 監視・ログ収集
