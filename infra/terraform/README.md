# Terraform Infrastructure for Dify

GCP上にDifyをホスティングするためのTerraform構成。

## 構成

```
GCP Project
├── VPC Network + Cloud NAT
├── GCE VM (Docker Compose で Dify を実行)
│   ├── Dify API/Web/Worker
│   └── Redis (コンテナ内)
├── Cloud SQL (PostgreSQL 15)
├── GCS Bucket (ファイルストレージ)
└── Load Balancer + Google管理SSL証明書
```

## 前提条件

- Terraform >= 1.0.0
- gcloud CLI（認証済み）
- GCPプロジェクト（課金有効化済み）

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集:

```bash
# GCP Configuration
TF_VAR_PROJECT_ID=your-gcp-project-id

# Domain Configuration
TF_VAR_DOMAIN=postchecker.team-mir.ai

# Dify Configuration
TF_VAR_SECRET_KEY=your-secret-key-here      # openssl rand -hex 32 で生成
TF_VAR_INIT_PASSWORD=your-admin-password
```

### 2. デプロイ

```bash
./deploy.sh
```

**重要**: `terraform apply` を直接実行しないでください。`deploy.sh` は以下を行います:

1. `.env` から環境変数を読み込み
2. `envsubst` で `terraform.tfvars` を生成
3. `terraform init && terraform apply` を実行

### 3. DNS設定

デプロイ完了後、出力される `lb_ip` をDNSのAレコードに設定:

```bash
terraform output lb_ip
```

Vercel Domainsの場合:
- Type: A
- Name: (サブドメイン、例: `postchecker`)
- Value: (出力されたIPアドレス)

### 4. SSL証明書の発行待ち

Google管理SSL証明書の発行には数分〜最大30分かかります。

確認コマンド:
```bash
gcloud compute ssl-certificates list --global
```

`ACTIVE` になれば https でアクセス可能です。

## ファイル構成

| ファイル | 説明 |
|---------|------|
| `main.tf` | Provider設定、API有効化 |
| `variables.tf` | 変数定義 |
| `outputs.tf` | 出力定義 |
| `network.tf` | VPC、サブネット、NAT、ファイアウォール |
| `database.tf` | Cloud SQL PostgreSQL |
| `storage.tf` | GCS バケット |
| `compute.tf` | GCE VM、サービスアカウント |
| `loadbalancer.tf` | LB、SSL証明書、HTTPSリダイレクト |
| `scripts/startup.sh` | VM起動時にDifyをセットアップするスクリプト |

## 運用

### VMにSSH接続

```bash
$(terraform output -raw ssh_command)
```

または:
```bash
gcloud compute ssh <vm_name> --zone=asia-northeast1-b --tunnel-through-iap
```

### Difyログ確認

```bash
# セットアップログ
sudo cat /var/log/dify-setup.log

# Dockerログ
cd /opt/dify/docker
docker compose logs -f
```

### Dify再起動

```bash
cd /opt/dify/docker
docker compose restart
```

### VMを再作成（startup-script変更時）

startup-scriptはVM作成時にのみ実行されます。変更を反映するには:

```bash
terraform taint google_compute_instance.dify
./deploy.sh
```

## コスト目安

| リソース | 月額（概算） |
|---------|------------|
| GCE VM (e2-standard-2) | ~$50 |
| Cloud SQL (db-f1-micro) | ~$10 |
| Load Balancer | ~$20 |
| GCS | ~$1 |
| **合計** | **~$80/月** |

※実際の使用量により変動します。

## トラブルシューティング

### SSL証明書が PROVISIONING のまま

- DNSが正しく設定されているか確認: `dig <domain>`
- LBのIPと一致しているか確認
- 最大30分待つ

### VMでDifyが起動しない

```bash
sudo cat /var/log/dify-setup.log
```

### Cloud SQL接続エラー

- VMとCloud SQLが同じVPCにあるか確認
- Private IPで接続しているか確認
