# AIBOD BOMOps

BOM（部品構成）＋セット（完成機）＋設置先＋設定情報（決済/ネットワーク）を **1装置単位** で一元管理する Dynamic BOM Platform。

## 概要

BOMOps は、AIBOD が提供する無人決済機 BAITEN STAND のような「装置提供ビジネス」のための管理システムです。
構造（Structure）× 設定（Configuration）× 運用（Operations）を、実機シリアル（Identity）と時系列（Lifecycle）で縦断して管理します。

最終的には BAITEN STAND だけでなく、Battery Circular Hub / FactoryOS 等、AIBOD の「実体物を伴う事業」を共通骨格で扱う **Physical AX 共通運用OS** を志向します（構想は `docs/DOC-PF-001`、設計の正本は `CLAUDE.md`）。

> 現在の実装範囲はプラットフォーム構想の **Asset Core 層**（構造・設定）＋ Ops Gateway の一部（保守/導入イベント）です。

## 技術スタック

- Python 3.11+ / Django 5.x / Django REST Framework
- PostgreSQL（本番は Cloud SQL PG16。ローカルは sqlite 設定でも可）
- JWT認証（djangorestframework-simplejwt）
- OpenAPI Schema（drf-spectacular）/ 横断検索（django-filter）
- 秘匿情報は Fernet 暗号化（`EncryptedTextField`）で保存・APIマスク
- フロントエンド: React 19 + TypeScript + Vite（`frontend/web/`）

## プロジェクト構造

```
bomops/
├── bomops_core/                # Django プロジェクトルート
│   ├── config/                 # プロジェクト設定
│   │   ├── settings.py         #   開発用設定
│   │   ├── settings_prod.py    #   本番用（Cloud Run / Cloud SQL）
│   │   ├── settings_sqlite.py  #   テスト・PostgreSQL不要環境用
│   │   ├── urls.py / wsgi.py / asgi.py
│   ├── bom/                    # BOMアプリケーション（全モデルを集約）
│   │   ├── models.py           #   データモデル（13モデル）
│   │   ├── fields.py           #   EncryptedTextField（Fernet暗号化）
│   │   ├── serializers.py      #   APIシリアライザ（secret系はマスク）
│   │   ├── views.py            #   APIビュー（追記型・カスタムAPI含む）
│   │   ├── pagination.py / exceptions.py
│   │   ├── urls.py / admin.py / tests.py
│   │   ├── management/commands/import_notion.py  # Notion実データ取り込み
│   │   └── migrations/
│   ├── manage.py
│   └── templates/
├── frontend/web/               # React + Vite SPA（Workspace / Dashboard）
├── domain_gateway/             # 空プレースホルダ（Domain Gateway 用・未実装）
├── ops_gateway/                # 空プレースホルダ（Ops Gateway 用・未実装）
├── scripts/gcp/                # GCP プロビジョニング/デプロイ スクリプト
├── docs/                       # 設計・選定・デプロイ・OpenAPI ドキュメント
├── docker-compose.yml / Dockerfile
├── requirements.txt / pytest.ini / .env.example
└── README.md
```

> ソースツリーは `bomops/` から **`bomops_core/`** にリネーム済みです（`Dockerfile` / `docker-compose.yml` / `scripts/gcp/*.sh` の `manage.py` 参照も対応済み）。

## セットアップ

### ローカル開発（Docker なし）

```bash
# 仮想環境の作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt

# 環境変数の設定
cp .env.example .env
export DJANGO_SETTINGS_MODULE=config.settings
export PYTHONPATH=$PWD/bomops_core

# マイグレーション
python bomops_core/manage.py migrate

# 管理者ユーザーの作成
python bomops_core/manage.py createsuperuser

# 開発サーバー起動
python bomops_core/manage.py runserver
```

### Docker Compose で起動

```bash
docker-compose up -d
docker-compose exec web python bomops_core/manage.py createsuperuser
```

### アクセス

- 管理画面: http://localhost:8000/admin/
- API ドキュメント (Swagger): http://localhost:8000/api/docs/
- API ドキュメント (ReDoc): http://localhost:8000/api/redoc/
- OpenAPI Schema: http://localhost:8000/api/schema/

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
| `/api/v1/site-configs/` | 拠点設定 CRUD（token/secret系は暗号化保存・レスポンスでマスク） |
| `/api/v1/maintenance-events/` | 保守イベント（追記型: 作成・閲覧のみ） |
| `/api/v1/deploy-events/` | 導入イベント（追記型: 作成・閲覧のみ） |
| `/api/v1/equipment-refs/` | 機器管理参照 CRUD（部品実物とN:M） |

### カスタムAPI

- `GET /api/v1/part-units/{id}/history/` - 部品使用履歴タイムライン
- `GET /api/v1/lookup/by-serial/?serial_number=XXX` - シリアル番号逆引き
- `GET /api/v1/dashboard/summary/` - ダッシュボードサマリー（状態別集計）
- `GET /api/v1/health/` - ヘルスチェック（認証不要）

> 追記型イベント（maintenance / deploy）は API・管理画面とも更新・削除不可。Dynamic BOM の「履歴を消さない」原則（`CLAUDE.md` §4.3）。

## フロントエンド

`frontend/web/` に Workspace（レコードのCRUD・検索・部品使用履歴）/ Dashboard（集計）の React SPA があります。
セットアップ・開発手順は `frontend/web/README.md` を参照。

## Notion 実データの取り込み

`from_notion/extracts/` の Notion エクスポートを冪等に取り込みます（自然キーで upsert）。

```bash
python bomops_core/manage.py import_notion --dir ../from_notion/extracts --dry-run
python bomops_core/manage.py import_notion --dir ../from_notion/extracts
```

## デプロイ（GCP）

Cloud Run + Cloud SQL + Firebase Hosting 構成。検証環境は稼働中です。

- SPA: https://baiten-gcp.web.app （Firebase Hosting）
- API: Cloud Run `bomops-api`（asia-northeast1）。`/api/**` は Hosting rewrite で Cloud Run へ転送（同一オリジン・CORS不要）

手順の詳細は `docs/gcp-deploy.md` を参照。

```bash
./scripts/gcp/setup.sh             # 初回プロビジョニング（Cloud SQL作成・課金開始に注意）
./scripts/gcp/deploy.sh            # バックエンド ビルド＆デプロイ（マイグレーション込み）
./scripts/gcp/create-superuser.sh admin admin@aibod.com
./scripts/gcp/deploy-frontend.sh   # フロントエンド（Firebase Hosting）
```

## テスト実行

```bash
# Django標準テスト
python bomops_core/manage.py test bom

# pytest
pytest

# PostgreSQL を起動していない環境では sqlite 設定で実行
pytest --ds=config.settings_sqlite
```

## ドキュメント

設計の正本は `CLAUDE.md`。主要ドキュメントは `docs/`（プラットフォーム構想 `DOC-PF-001`、Commerce Gateway `DOC-APP-001`、フロント設計 `DOC-FE-001`、クラウド選定 `DOC-IF-001`、デプロイ手順 `gcp-deploy.md`）。

## ライセンス

Proprietary - AIBOD Inc.
