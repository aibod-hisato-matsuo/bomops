#!/usr/bin/env bash
# Cloud Run Job 経由で Django スーパーユーザーを作成する
#
# 使い方: ./create-superuser.sh <username> <email>
# パスワードはその場で生成して表示する（初回ログイン後に変更すること）

set -euo pipefail
cd "$(dirname "$0")"
source ./config.sh

USERNAME="${1:?username を指定してください}"
EMAIL="${2:?email を指定してください}"
PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(16))')"

JOB_NAME="bomops-createsuperuser"
IMAGE_CURRENT="$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" --project "${PROJECT_ID}" \
  --format 'value(spec.template.spec.containers[0].image)')"

COMMON_ENV="DJANGO_SETTINGS_MODULE=config.settings_prod"
COMMON_ENV+=",POSTGRES_HOST=/cloudsql/${SQL_CONNECTION_NAME}"
COMMON_ENV+=",POSTGRES_DB=${DB_NAME},POSTGRES_USER=${DB_USER}"
COMMON_ENV+=",DJANGO_SUPERUSER_USERNAME=${USERNAME}"
COMMON_ENV+=",DJANGO_SUPERUSER_EMAIL=${EMAIL}"
COMMON_ENV+=",DJANGO_SUPERUSER_PASSWORD=${PASSWORD}"
COMMON_SECRETS="DJANGO_SECRET_KEY=bomops-django-secret-key:latest"
COMMON_SECRETS+=",BOMOPS_ENCRYPTION_KEY=bomops-encryption-key:latest"
COMMON_SECRETS+=",POSTGRES_PASSWORD=bomops-db-password:latest"

if gcloud run jobs describe "${JOB_NAME}" --region "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  JOB_VERB="update"
else
  JOB_VERB="create"
fi
gcloud run jobs "${JOB_VERB}" "${JOB_NAME}" \
  --image "${IMAGE_CURRENT}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --set-cloudsql-instances "${SQL_CONNECTION_NAME}" \
  --set-env-vars "${COMMON_ENV}" \
  --set-secrets "${COMMON_SECRETS}" \
  --command python \
  --args "bomops/manage.py,createsuperuser,--noinput" \
  --max-retries 0

gcloud run jobs execute "${JOB_NAME}" --region "${REGION}" --project "${PROJECT_ID}" --wait

echo ""
echo "=== スーパーユーザー作成完了 ==="
echo "username: ${USERNAME}"
echo "password: ${PASSWORD}"
echo "初回ログイン後に管理画面からパスワードを変更してください"
