#!/usr/bin/env bash
# BOMOps GCP デプロイ共通設定（setup.sh / deploy.sh から source される）

export PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
export REGION="${REGION:-asia-northeast1}"

export SERVICE_NAME="bomops-api"
export MIGRATE_JOB_NAME="bomops-migrate"
export AR_REPO="bomops"
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE_NAME}"

export SQL_INSTANCE="bomops-pg"
export SQL_TIER="${SQL_TIER:-db-f1-micro}"   # 検証用。本番化時に db-g1-small 以上へ
export DB_NAME="bomops"
export DB_USER="bomops"
export SQL_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID が未設定です（gcloud config set project <id> するか PROJECT_ID=... を指定）" >&2
  exit 1
fi
