#!/usr/bin/env bash
# BOMOps GCP 初回プロビジョニング（1回だけ実行）
#
# 実行内容:
#   1. 必要APIの有効化
#   2. Artifact Registry リポジトリ作成
#   3. Cloud SQL (PostgreSQL) インスタンス・DB・ユーザー作成
#   4. Secret Manager にシークレット登録（DJANGO_SECRET_KEY / BOMOPS_ENCRYPTION_KEY / DB パスワード）
#   5. Cloud Run 実行サービスアカウントへの権限付与
#
# 注意: Cloud SQL は作成した時点から課金が発生する（db-f1-micro で月額約1,500円）

set -euo pipefail
cd "$(dirname "$0")"
source ./config.sh

echo "=== BOMOps GCP setup: project=${PROJECT_ID} region=${REGION} ==="

echo "--- 1/5 APIの有効化"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  --project "${PROJECT_ID}"

echo "--- 2/5 Artifact Registry リポジトリ"
if ! gcloud artifacts repositories describe "${AR_REPO}" \
    --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format docker \
    --location "${REGION}" \
    --project "${PROJECT_ID}" \
    --description "BOMOps container images"
else
  echo "既存リポジトリを使用: ${AR_REPO}"
fi

echo "--- 3/5 Cloud SQL インスタンス（数分かかります）"
if ! gcloud sql instances describe "${SQL_INSTANCE}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud sql instances create "${SQL_INSTANCE}" \
    --database-version POSTGRES_16 \
    --edition enterprise \
    --tier "${SQL_TIER}" \
    --region "${REGION}" \
    --storage-size 10GB \
    --storage-auto-increase \
    --backup-start-time 18:00 \
    --project "${PROJECT_ID}"
else
  echo "既存インスタンスを使用: ${SQL_INSTANCE}"
fi

if ! gcloud sql databases describe "${DB_NAME}" --instance "${SQL_INSTANCE}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud sql databases create "${DB_NAME}" --instance "${SQL_INSTANCE}" --project "${PROJECT_ID}"
fi

DB_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
if ! gcloud sql users list --instance "${SQL_INSTANCE}" --project "${PROJECT_ID}" --format='value(name)' | grep -qx "${DB_USER}"; then
  gcloud sql users create "${DB_USER}" \
    --instance "${SQL_INSTANCE}" \
    --password "${DB_PASSWORD}" \
    --project "${PROJECT_ID}"
else
  echo "既存DBユーザーのパスワードを更新: ${DB_USER}"
  gcloud sql users set-password "${DB_USER}" \
    --instance "${SQL_INSTANCE}" \
    --password "${DB_PASSWORD}" \
    --project "${PROJECT_ID}"
fi

echo "--- 4/5 Secret Manager"
create_or_update_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "${name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project "${PROJECT_ID}"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" --data-file=- --project "${PROJECT_ID}"
  fi
}

create_or_update_secret "bomops-db-password" "${DB_PASSWORD}"

if ! gcloud secrets describe "bomops-django-secret-key" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  create_or_update_secret "bomops-django-secret-key" \
    "$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"
fi
if ! gcloud secrets describe "bomops-encryption-key" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  create_or_update_secret "bomops-encryption-key" \
    "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
fi

echo "--- 5/5 サービスアカウント権限"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for role in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${RUN_SA}" \
    --role "${role}" \
    --condition None \
    --quiet >/dev/null
done

echo ""
echo "=== セットアップ完了 ==="
echo "Cloud SQL 接続名: ${SQL_CONNECTION_NAME}"
echo "次: ./deploy.sh でビルド＆デプロイ"
