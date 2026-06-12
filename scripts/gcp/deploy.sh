#!/usr/bin/env bash
# BOMOps ビルド＆デプロイ（Cloud Build → Cloud Run + マイグレーションJob）
#
# 前提: setup.sh 実行済み
# 使い方: ./deploy.sh

set -euo pipefail
cd "$(dirname "$0")"
source ./config.sh
REPO_ROOT="$(cd ../.. && pwd)"

TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE_TAGGED="${IMAGE}:${TAG}"

echo "=== 1/4 コンテナビルド（Cloud Build）: ${IMAGE_TAGGED}"
gcloud builds submit "${REPO_ROOT}" \
  --tag "${IMAGE_TAGGED}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}"

COMMON_ENV="DJANGO_SETTINGS_MODULE=config.settings_prod"
COMMON_ENV+=",POSTGRES_HOST=/cloudsql/${SQL_CONNECTION_NAME}"
COMMON_ENV+=",POSTGRES_DB=${DB_NAME},POSTGRES_USER=${DB_USER}"
COMMON_SECRETS="DJANGO_SECRET_KEY=bomops-django-secret-key:latest"
COMMON_SECRETS+=",BOMOPS_ENCRYPTION_KEY=bomops-encryption-key:latest"
COMMON_SECRETS+=",POSTGRES_PASSWORD=bomops-db-password:latest"

echo "=== 2/4 マイグレーションJob"
if gcloud run jobs describe "${MIGRATE_JOB_NAME}" --region "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  JOB_VERB="update"
else
  JOB_VERB="create"
fi
gcloud run jobs "${JOB_VERB}" "${MIGRATE_JOB_NAME}" \
  --image "${IMAGE_TAGGED}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --set-cloudsql-instances "${SQL_CONNECTION_NAME}" \
  --set-env-vars "${COMMON_ENV}" \
  --set-secrets "${COMMON_SECRETS}" \
  --command python \
  --args "bomops/manage.py,migrate,--noinput" \
  --max-retries 1

echo "=== 3/4 マイグレーション実行"
gcloud run jobs execute "${MIGRATE_JOB_NAME}" \
  --region "${REGION}" --project "${PROJECT_ID}" --wait

echo "=== 4/4 Cloud Run デプロイ"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAGGED}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --set-cloudsql-instances "${SQL_CONNECTION_NAME}" \
  --set-env-vars "${COMMON_ENV},DJANGO_ALLOWED_HOSTS=.run.app,CSRF_TRUSTED_ORIGINS=https://*.run.app" \
  --set-secrets "${COMMON_SECRETS}" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')"

echo ""
echo "=== デプロイ完了 ==="
echo "API URL:      ${SERVICE_URL}"
echo "ヘルスチェック: curl ${SERVICE_URL}/api/v1/health/"
echo "管理画面:      ${SERVICE_URL}/admin/"
echo ""
echo "管理者ユーザー作成（初回のみ）:"
echo "  ./create-superuser.sh <username> <email>"
