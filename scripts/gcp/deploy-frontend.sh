#!/usr/bin/env bash
# フロントエンド（React SPA）を Firebase Hosting へデプロイする
#
# 前提: firebase login 済み、Firebase プロジェクトで Hosting 有効化済み
# /api/** は firebase.json の rewrite で Cloud Run (bomops-api) に転送される

set -euo pipefail
cd "$(dirname "$0")/../../frontend/web"

export PATH="$HOME/.nodebrew/current/bin:$PATH"

echo "=== 1/2 ビルド"
npm run build

echo "=== 2/2 Firebase Hosting デプロイ"
firebase deploy --only hosting

echo ""
echo "=== 完了 ==="
echo "Hosting URL は上記出力を参照（https://<project>.web.app）"
