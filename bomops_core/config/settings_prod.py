"""
本番（Cloud Run）用設定

使い方: DJANGO_SETTINGS_MODULE=config.settings_prod
- DEBUG無効・セキュリティヘッダ有効
- 静的ファイルは WhiteNoise で配信（Django admin / API docs 用）
- DB は Cloud SQL（POSTGRES_HOST に /cloudsql/<接続名> のUNIXソケットパスを指定）
- 機密値（DJANGO_SECRET_KEY 等）は Secret Manager から環境変数として注入する
"""

import os

from .settings import *  # noqa: F401,F403
from .settings import MIDDLEWARE

DEBUG = False

# 本番ではデフォルトの insecure キーを許さない（未設定なら起動時に落とす）
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", ".run.app").split(",")

# Cloud Run / Firebase Hosting のオリジンを設定する（例: https://bomops-api-xxxx.run.app）
CSRF_TRUSTED_ORIGINS = [
    origin
    for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin
]

# WhiteNoise（SecurityMiddleware の直後に挿入）
MIDDLEWARE = (
    MIDDLEWARE[:1]
    + ["whitenoise.middleware.WhiteNoiseMiddleware"]
    + MIDDLEWARE[1:]
)

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Cloud Run は前段でTLS終端し X-Forwarded-Proto を付与する
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.getenv("DJANGO_SSL_REDIRECT", "True").lower() in ("true", "1")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# CORS: Firebase Hosting の rewrite 経由（同一オリジン）が基本のため原則不要。
# 直接 run.app ドメインへアクセスする構成の場合のみ環境変数で許可する。
CORS_ALLOW_ALL_ORIGINS = False
