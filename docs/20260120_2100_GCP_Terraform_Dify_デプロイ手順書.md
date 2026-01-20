# GCP Terraform Dify デプロイ手順書

## 概要

本ドキュメントは、GCPにTerraformを使ってDifyをデプロイするための詳細な手順書です。
小さくPDCAを回しながら段階的にデプロイを進めることを想定しています。

---

## 前提条件

- GCPアカウントが準備済み
- GCPプロジェクトが作成済み（または作成予定）
- ローカルにTerraform >= 1.0.0 がインストール済み
- gcloud CLI がインストール済み

---

## Phase 1: GCP準備（管理画面操作）

### 1.1 GCPプロジェクトの作成（未作成の場合）

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 画面上部のプロジェクトセレクタをクリック
3. 「新しいプロジェクト」をクリック
4. プロジェクト名を入力（例: `team-mirai-dify`）
5. 組織を選択（該当する場合）
6. 「作成」をクリック
7. **プロジェクトIDをメモ**（terraform.tfvarsで使用）

### 1.2 請求先アカウントの紐付け

1. 左メニュー「お支払い」をクリック
2. 「プロジェクトをリンク」または「請求先アカウントを管理」
3. 有効な請求先アカウントを選択して紐付け

> **重要**: 請求先アカウントが紐付けられていないと、APIの有効化やリソース作成ができません

### 1.3 gcloud CLI の認証設定

ローカルターミナルで以下を実行:

```bash
# GCPにログイン
gcloud auth login

# アプリケーションデフォルト認証（Terraform用）
gcloud auth application-default login

# プロジェクトを設定
gcloud config set project YOUR_PROJECT_ID
```

---

## Phase 2: Terraform初期設定

### 2.1 作業ディレクトリへ移動

```bash
cd infra/terraform
```

### 2.2 terraform.tfvarsファイルの作成

```bash
cp terraform.tfvars.example terraform.tfvars
```

### 2.3 terraform.tfvars の編集

```hcl
# GCP Project Configuration
project_id  = "your-actual-project-id"  # ← Phase 1.1でメモしたプロジェクトID
region      = "asia-northeast1"
environment = "dev"

# Cloud SQL Configuration (最小構成)
db_tier = "db-f1-micro"
db_name = "dify"
db_user = "dify"

# Redis Configuration (最小構成)
redis_memory_size_gb = 1
redis_tier           = "BASIC"

# Cloud Run Configuration (最小構成)
cloud_run_min_instances = 0
cloud_run_max_instances = 2
cloud_run_cpu           = "1"
cloud_run_memory        = "512Mi"

# Dify Configuration
dify_version = "0.15.3"
```

> **注意**: `secret_key` と `init_password` は terraform.tfvars に記載しないでください。
> 以下の「シークレットの設定」セクションで GCP Secret Manager 経由で設定します。

### 2.4 シークレットの設定（GCP Secret Manager）

セキュリティのベストプラクティスとして、機密情報は GCP Secret Manager で管理します。

#### シークレットキーの生成

```bash
# 32文字以上のランダム文字列を生成
openssl rand -hex 32
```

#### GCP Secret Manager にシークレットを作成

```bash
# プロジェクトIDを設定
export PROJECT_ID="your-actual-project-id"

# secret_key を作成
echo -n "$(openssl rand -hex 32)" | gcloud secrets create dify-secret-key \
  --project=$PROJECT_ID \
  --replication-policy="automatic" \
  --data-file=-

# init_password を作成
echo -n "your-secure-admin-password" | gcloud secrets create dify-init-password \
  --project=$PROJECT_ID \
  --replication-policy="automatic" \
  --data-file=-
```

#### Terraform変数でシークレット名を指定

terraform.tfvars に以下を追加:

```hcl
# Secret Manager のシークレット名（値ではなく名前のみ）
secret_key_secret_name    = "dify-secret-key"
init_password_secret_name = "dify-init-password"
```

> **重要**: tfvarsファイルには機密値を直接記載せず、Secret Manager のシークレット名のみを指定します。
> Terraform は `data.google_secret_manager_secret_version` を使用して実行時に値を取得します。

### 2.5 .gitignore の確認

`terraform.tfvars` がコミットされないことを確認:

```bash
# .gitignore に以下が含まれていることを確認
grep "terraform.tfvars" .gitignore
```

含まれていない場合は追加:

```bash
echo "infra/terraform/terraform.tfvars" >> ../../.gitignore
```

---

## Phase 3: Terraform実行（段階的デプロイ）

### 3.1 Terraform初期化

```bash
terraform init
```

**確認ポイント**:
- `Terraform has been successfully initialized!` と表示されること
- `.terraform/` ディレクトリが作成されること

### 3.2 実行計画の確認（重要）

```bash
terraform plan
```

**確認ポイント**:
- 作成されるリソース一覧を確認
- エラーがないこと
- 予想されるリソース数（概算15-20リソース）

主要リソース:
| リソース | 説明 |
|---------|------|
| google_project_service | 7つのAPI有効化 |
| google_compute_network | VPCネットワーク |
| google_compute_subnetwork | サブネット |
| google_vpc_access_connector | VPCコネクタ |
| google_sql_database_instance | Cloud SQL (PostgreSQL) |
| google_redis_instance | Redis |
| google_cloud_run_v2_service | Cloud Run x 3 (API/Web/Worker) |
| google_secret_manager_secret | シークレット x 3 |
| google_service_account | サービスアカウント |
| google_storage_bucket | Cloud Storage（ナレッジ・ファイル保存用） |

### 3.3 デプロイ実行

```bash
terraform apply
```

1. 実行計画が表示される
2. `Do you want to perform these actions?` に `yes` と入力
3. デプロイが開始される

**所要時間目安**:
- API有効化: 1-2分
- VPCネットワーク: 1-2分
- Cloud SQL: 5-10分（最も時間がかかる）
- Redis: 3-5分
- Cloud Run: 1-2分

**合計: 約15-20分**

### 3.4 出力値の確認

デプロイ完了後、以下のコマンドで出力を確認:

```bash
terraform output
```

出力例:
```
api_url = "https://dify-dev-api-xxxxxxxx-an.a.run.app"
web_url = "https://dify-dev-web-xxxxxxxx-an.a.run.app"
worker_service_name = "dify-dev-worker-xxxxxxxx"
```

---

## Phase 4: 動作確認

### 4.1 Web UIへのアクセス

1. `terraform output web_url` で表示されたURLにブラウザでアクセス
2. 初期セットアップ画面が表示されることを確認

### 4.2 初期管理者アカウントの作成

1. Web UIで「Get Started」または「開始する」をクリック
2. メールアドレスとパスワードを入力（init_passwordで設定した値）
3. 管理者アカウントを作成

### 4.3 API疎通確認

```bash
# APIヘルスチェック
curl $(terraform output -raw api_url)/health
```

期待される応答: `{"status":"ok"}` または類似のレスポンス

### 4.4 Cloud Runサービス状態確認（GCP管理画面）

1. [Cloud Run Console](https://console.cloud.google.com/run) にアクセス
2. 3つのサービスが表示されることを確認:
   - `dify-dev-api-xxxxxxxx`
   - `dify-dev-web-xxxxxxxx`
   - `dify-dev-worker-xxxxxxxx`
3. 各サービスをクリックしてログを確認

---

## Phase 5: トラブルシューティング

### 5.1 よくあるエラーと対処法

#### エラー: API未有効化

```
Error: googleapi: Error 403: ... API has not been enabled
```

**対処法**: 手動でAPIを有効化

```bash
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable vpcaccess.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable servicenetworking.googleapis.com
```

#### エラー: 請求先アカウント未設定

```
Error: googleapi: Error 403: ... billing account
```

**対処法**: Phase 1.2 を実施

#### エラー: 権限不足

```
Error: googleapi: Error 403: ... permission denied
```

**対処法**: プロジェクトオーナーまたは以下のロールが必要
- Cloud Run Admin
- Cloud SQL Admin
- Compute Network Admin
- Secret Manager Admin
- Service Account Admin

#### エラー: リソース名の重複

```
Error: googleapi: Error 409: Resource already exists
```

**対処法**:
1. `terraform state list` で状態を確認
2. 既存リソースを削除するか、`terraform import` で取り込む

### 5.2 ログの確認方法

```bash
# Cloud Runログの確認（gcloud CLI）
gcloud run services logs read dify-dev-api-xxxxxxxx --region=asia-northeast1

# または、Cloud Logging Console で確認
# https://console.cloud.google.com/logs
```

### 5.3 リソースの削除（やり直す場合）

```bash
# 全リソースを削除
terraform destroy
```

> **警告**: `terraform destroy` はすべてのリソース（データベース含む）を削除します

---

## Phase 6: デプロイ後の設定（管理画面操作）

### 6.1 URL環境変数について

Terraform設定では、Cloud RunサービスのURLは `google_cloud_run_v2_service.*.uri` を使用して
自動的に他のサービスから参照されるように設計されています。

```hcl
# cloudrun.tf での自動参照の例
env {
  name  = "CONSOLE_API_URL"
  value = google_cloud_run_v2_service.api.uri
}
```

これにより、1回の `terraform apply` でデプロイが完了し、
手動でURLをコピーして再適用する必要はありません。

> **注意**: 現在のTerraform設定でURL参照が空文字になっている場合は、
> 上記のような動的参照に更新することを推奨します。
> `depends_on` を適切に設定することで、依存関係も解決されます。

### 6.2 カスタムドメインの設定（オプション）

1. [Cloud Run Console](https://console.cloud.google.com/run) にアクセス
2. 対象サービスをクリック
3. 「ドメイン」タブ → 「カスタムドメインを追加」
4. ドメインを入力してDNS設定を行う

### 6.3 認証設定（本番環境では必須）

本番環境では、認証なしでのアクセスを許可しないでください。
以下のいずれかの認証方式を設定する必要があります。

#### 方式A: Identity-Aware Proxy（IAP）の設定

Google Workspaceアカウントでの認証に最適:

1. [IAP Console](https://console.cloud.google.com/security/iap) にアクセス
2. Cloud Runサービスを選択
3. IAPを有効化
4. 許可するユーザー/グループを設定

#### 方式B: Firebase Authentication

一般ユーザー向けの認証に最適:

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを設定
2. 認証プロバイダー（Google, Email/Password等）を有効化
3. Difyアプリケーションに認証ミドルウェアを追加

### 6.4 Cloud Armor（WAF）の設定

DDoS攻撃やWebアプリケーション攻撃からの保護:

1. [Cloud Armor Console](https://console.cloud.google.com/net-security/securitypolicies) にアクセス
2. 「セキュリティポリシーを作成」をクリック
3. ルールを追加（IP制限、レート制限、OWASP Top 10対策等）
4. Cloud Runサービスにポリシーを適用

> **dev環境のみ**: 開発環境では認証なしでのアクセスを一時的に許可できますが、
> staging/prod環境では必ず認証を設定してください。

---

## Phase 7: 本番運用に向けて

### 7.1 環境分離

`environment` 変数を変更して別環境を作成:

```hcl
# staging環境
environment = "staging"

# production環境
environment = "prod"
```

### 7.2 リソーススケールアップ（本番用）

```hcl
# Cloud SQL
db_tier = "db-g1-small"  # または "db-custom-2-4096"

# Redis
redis_memory_size_gb = 2
redis_tier           = "STANDARD_HA"  # 高可用性

# Cloud Run
cloud_run_min_instances = 1  # コールドスタート防止
cloud_run_max_instances = 10
cloud_run_cpu           = "2"
cloud_run_memory        = "2Gi"
```

### 7.3 バックアップ確認

Cloud SQLの自動バックアップが有効になっていることを確認:

1. [Cloud SQL Console](https://console.cloud.google.com/sql) にアクセス
2. インスタンスを選択
3. 「バックアップ」タブで設定を確認

---

## コスト見積もり（最小構成）

| リソース | 月額概算（USD） |
|---------|----------------|
| Cloud SQL (db-f1-micro) | ~$10-15 |
| Cloud Memorystore Redis (1GB BASIC) | ~$35-40 |
| Cloud Run (従量課金) | ~$5-20 |
| VPC Access Connector | ~$20-30 |
| Secret Manager | ~$0.06 |
| Cloud Storage | ~$0.02/GB（使用量により変動） |
| **合計** | **約$70-110/月** |

> **注意**: 実際のコストはトラフィック量やストレージ使用量により変動します。
> Cloud Storageは保存するナレッジデータやファイルの量に応じて増加します（10GB で約$0.20/月）。

---

## チェックリスト

### デプロイ前
- [ ] GCPプロジェクト作成済み
- [ ] 請求先アカウント紐付け済み
- [ ] gcloud CLI認証済み
- [ ] terraform.tfvars作成済み
- [ ] シークレット値を設定済み

### デプロイ中
- [ ] `terraform init` 成功
- [ ] `terraform plan` でエラーなし
- [ ] `terraform apply` 完了

### デプロイ後
- [ ] Web UIにアクセス可能
- [ ] 初期管理者アカウント作成
- [ ] APIヘルスチェック成功
- [ ] Cloud Runログでエラーなし

---

## 参考リンク

- [Dify公式ドキュメント](https://docs.dify.ai/)
- [Google Cloud Run ドキュメント](https://cloud.google.com/run/docs)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [プロジェクトアーキテクチャ](./architecture.md)
