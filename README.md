# AIBOD Factory / BOMOps

BOM（部品構成）＋セット（完成機）＋設置先＋設定情報（決済/ネットワーク）の一元管理システム

## 概要

BOMOps は、AIBOD が提供する無人決済機 BAITEN STAND のような「装置提供ビジネス」のための管理システムです。

## 技術スタック

- Python 3.11+
- Django 5.x
- Django REST Framework
- PostgreSQL
- JWT認証（djangorestframework-simplejwt）
- OpenAPI Schema（drf-spectacular）

## プロジェクト構造

```
bomops/
├── bomops/                    # Django プロジェクトルート
│   ├── config/                # プロジェクト設定
│   │   ├── __init__.py
│   │   ├── settings.py        # Django設定
│   │   ├── urls.py            # ルートURL設定
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── bom/                   # BOMアプリケーション
│   │   ├── __init__.py
│   │   ├── admin.py           # 管理画面設定
│   │   ├── apps.py
│   │   ├── models.py          # データモデル
│   │   ├── serializers.py     # APIシリアライザ
│   │   ├── views.py           # APIビュー
│   │   ├── urls.py            # APIルーティング
│   │   ├── tests.py           # テスト
│   │   └── migrations/
│   └── manage.py
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── pytest.ini
├── .env.example
└── README.md
```

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
# .env ファイルを編集して適切な値を設定
```

### 2. Docker Compose で起動

```bash
docker-compose up -d
```

### 3. 管理者ユーザーの作成

```bash
docker-compose exec web python bomops/manage.py createsuperuser
```

### 4. アクセス

- 管理画面: http://localhost:8000/admin/
- API ドキュメント (Swagger): http://localhost:8000/api/docs/
- API ドキュメント (ReDoc): http://localhost:8000/api/redoc/
- OpenAPI Schema: http://localhost:8000/api/schema/

## ローカル開発（Docker なし）

```bash
# 仮想環境の作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt

# 環境変数の設定
export DJANGO_SETTINGS_MODULE=config.settings
export PYTHONPATH=$PWD/bomops

# マイグレーション
python bomops/manage.py migrate

# 開発サーバー起動
python bomops/manage.py runserver
```

## API エンドポイント

### 認証

- `POST /api/v1/auth/token/` - JWTトークン取得
- `POST /api/v1/auth/token/refresh/` - トークンリフレッシュ
- `POST /api/v1/auth/token/verify/` - トークン検証

### リソース

| エンドポイント | 説明 |
|--------------|------|
| `/api/v1/part-masters/` | 部品マスタ CRUD |
| `/api/v1/part-units/` | 部品実物 CRUD |
| `/api/v1/product-models/` | 製品モデル CRUD |
| `/api/v1/product-boms/` | 製品BOM CRUD |
| `/api/v1/customers/` | 顧客 CRUD |
| `/api/v1/customer-sites/` | 顧客拠点 CRUD |
| `/api/v1/bss-sets/` | BSSセット CRUD |
| `/api/v1/bss-set-components/` | セット構成部品 CRUD |
| `/api/v1/bss-set-configs/` | セット設定 CRUD |

### カスタムAPI

- `GET /api/v1/bss-sets/{id}/composition/` - セット構成ビュー
- `GET /api/v1/bss-sets/{id}/effective-configs/` - 有効なコンフィグ一覧
- `GET /api/v1/lookup/by-serial/?serial_number=XXX` - シリアル番号逆引き

## テスト実行

```bash
# Django標準テスト
python bomops/manage.py test bom

# pytest
pytest
```

## ライセンス

Proprietary - AIBOD Inc.
