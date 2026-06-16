"""
ローカル実行用テスト設定

PostgreSQL が起動していない環境でテスト・開発サーバを実行するための sqlite 設定。
使い方:
  pytest --ds=config.settings_sqlite
  SQLITE_PATH=/tmp/bomops.sqlite3 python manage.py runserver --settings=config.settings_sqlite
"""

import os

from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.getenv("SQLITE_PATH", ":memory:"),
    }
}
