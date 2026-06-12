# BOMOps GCP デプロイ手順（検証環境）

DOC-IF-001（クラウド選定検討書）§6 の構成を実現する手順。
対象プロジェクト: `baiten-gcp` / リージョン: `asia-northeast1`（東京）

## 構成

```
Firebase Hosting (React SPA)
  └─ /api/** rewrite → Cloud Run (bomops-api: Django + gunicorn + WhiteNoise)
                          └─ Cloud SQL (PostgreSQL 16, UNIXソケット接続)
                          └─ Secret Manager (SECRET_KEY / 暗号化キー / DBパスワード)
```

- SPA と API が同一オリジンになるため CORS 設定が不要
- マイグレーションは Cloud Run Job (`bomops-migrate`) で実行（deploy.sh が毎回実行）

## 事前条件

- `gcloud` 認証済み・プロジェクト設定済み（`gcloud config set project baiten-gcp`）
- `firebase login` 済み・対象プロジェクトで Hosting を有効化済み
- 課金有効なプロジェクトであること（**Cloud SQL は作成時点から課金。db-f1-micro で月額約1,500円**）

## 手順

```bash
# 1. 初回プロビジョニング（1回だけ。Cloud SQL作成に数分かかる）
./scripts/gcp/setup.sh

# 2. バックエンドのビルド＆デプロイ（マイグレーション込み）
./scripts/gcp/deploy.sh

# 3. 管理者ユーザー作成（初回のみ。パスワードが表示される）
./scripts/gcp/create-superuser.sh admin admin@aibod.com

# 4. フロントエンドのデプロイ
./scripts/gcp/deploy-frontend.sh
```

## 動作確認

```bash
# ヘルスチェック（認証不要）
curl https://bomops-api-<hash>.run.app/api/v1/health/

# SPA（Firebase Hosting URL）にアクセスしてログイン
open https://baiten-gcp.web.app
```

## 環境変数とシークレット

| 変数 | 注入方法 | 値 |
|------|---------|-----|
| `DJANGO_SETTINGS_MODULE` | env | `config.settings_prod` |
| `POSTGRES_HOST` | env | `/cloudsql/<project>:<region>:bomops-pg`（UNIXソケット） |
| `DJANGO_SECRET_KEY` | Secret Manager | `bomops-django-secret-key` |
| `BOMOPS_ENCRYPTION_KEY` | Secret Manager | `bomops-encryption-key`（SiteConfig暗号化） |
| `POSTGRES_PASSWORD` | Secret Manager | `bomops-db-password` |

## 検証環境の暫定事項（本番化前に対応）

- Cloud Run は `--allow-unauthenticated`（API自体はJWT必須、adminはパスワード保護）。
  本番化時は **IAP（Google Workspace SSO）** を前段に追加する
- Cloud SQL は `db-f1-micro`（共有コア）。本番化時に `db-g1-small` 以上へ変更
- CI/CD 未設定（手動 deploy.sh）。Git リモート確定後に Cloud Build トリガー or GitHub Actions を設定
- `BOMOPS_ENCRYPTION_KEY` は一度データを暗号化した後に変更しないこと（復号不能になる）

## 削除（検証を畳む場合）

```bash
source scripts/gcp/config.sh
gcloud run services delete ${SERVICE_NAME} --region ${REGION}
gcloud run jobs delete ${MIGRATE_JOB_NAME} --region ${REGION}
gcloud sql instances delete ${SQL_INSTANCE}   # 課金停止はこれが本体
gcloud artifacts repositories delete ${AR_REPO} --location ${REGION}
```
