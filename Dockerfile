# BOMOps Dockerfile（Cloud Run 対応）
# 開発時は docker-compose.yml が command を runserver に上書きする
FROM python:3.11-slim

# 環境変数設定
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/bomops

# 作業ディレクトリ設定
WORKDIR /app

# Python依存パッケージのインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードのコピー
COPY . .

# 静的ファイルの収集（WhiteNoise配信用。SECRET_KEYはビルド時ダミー）
RUN DJANGO_SECRET_KEY=collectstatic-build-dummy \
    python bomops/manage.py collectstatic --noinput --settings=config.settings_prod

# Cloud Run は $PORT（既定8080）で待ち受ける
EXPOSE 8080

# 起動コマンド（本番: gunicorn。$PORT 展開のため shell 形式）
CMD exec gunicorn config.wsgi:application \
    --chdir bomops \
    --bind 0.0.0.0:${PORT:-8080} \
    --workers 2 \
    --threads 4 \
    --timeout 60
