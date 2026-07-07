# CLAUDE.md — AIBOD BOMOps

> このファイルは Claude Code が **AIBOD BOMOps** リポジトリで作業する際の最上位コンテキストです。
> 設計判断に迷ったら、まず本ファイルの「ドメインモデル（正準スキーマ）」と「設計原則」に立ち返ること。

---

## 1. プロジェクト概要

**BOMOps（BOM Operations Platform）** は、小ロット・現場導入型デバイス（無人決済機 BAITEN STAND、工場AIカメラ、スマートロッカー、IoTゲートウェイ等）を **「1装置単位」** で統合管理する Dynamic BOM Platform。

従来の静的BOM / ERP / 資産管理 / IoTプラットフォームのいずれにも収まらない、以下の **三軸を1装置単位で統合** する新カテゴリを実装する。

```
BOMOps = Structure（構造） × Configuration（設定） × Operations（運用）
```

- **Structure（構造）**：部品マスタ → 実物シリアル → セット（1台構成）
- **Configuration（設定）**：拠点ごとのPOS設定・決済API・ネットワーク・バージョン
- **Operations（運用）**：設置先・稼働状況・故障/交換履歴・現場差分

これらを **Identity（シリアル）** と **Lifecycle（時系列）** が縦断する。

### 設計の北極星
1. **1セット = 1 Digital Twin**（"Set Twin"）。どの実機(S/N)が、どの拠点で、どの設定で、どんな履歴で動いているかを1つのTwinで辿れること。
2. **Dynamic BOM**：BOMは製造時のレシピではなく、設置後の交換・更新・代替・設定変更まで「構成の時間軸」を持つ。**履歴を消さない（追記型）**。
3. **DeployOps**：設置→開通→稼働→トラブル→交換→回収→再組立の全工程でデータが途切れない。

### プラットフォーム構想（v0.1 / `docs/DOC-PF-001`）
BOMOps は最終的に AIBOD の「実体物を伴う事業」（BAITEN STAND / Battery Circular Hub・BIE / FactoryOS 等）を共通骨格で扱う **Physical AX 共通運用OS** を志向する。レイヤは以下の5層：

```
Asset Core（静的構成・台帳・契約・接続）           ← ★現在の実装はここ（bomops_core/bom）
 + Domain Intelligence Gateway（ドメイン固有の評価・商流）  ← BAITEN=Commerce Gateway（docs/DOC-APP-001）
 + Ops Gateway（稼働ログ・状態・イベント・保守履歴）
 + Workcode Connector（業務タスク化・運用フロー）
 + DIO Connector（Detect/Forecast/Plan/Execute/Evaluate）
```

- **現在地**：`bomops_core` は Asset Core（構造・設定）＋ Ops Gateway の一部（`MaintenanceEvent`/`DeployEvent`）を実装済み。
- **次段の置き場所**：`domain_gateway/`・`ops_gateway/` はこの構想のための空プレースホルダ（未実装）。新ドメイン機能を足す前に DOC-PF-001 の層対応を確認すること。
- BAITEN の最初の Domain Gateway は **Commerce Gateway**（Loyverse 連携・業者別売上集計・委託販売手数料・自動精算）。仕様は `docs/DOC-APP-001`。

---

## 2. 技術スタック

| 領域 | 採用 |
|------|------|
| 言語/FW | **Python 3.11+ / Django 5 + Django REST Framework** |
| API補助 | **drf-spectacular**（OpenAPI）・**django-filter**（横断検索）・DRFページネーション（既定50件/最大200件） |
| DB | **PostgreSQL**（本番=Cloud SQL PG16 / ローカルは sqlite 設定も可） |
| 認証 | **JWT（djangorestframework-simplejwt）** |
| 暗号化 | **Fernet（cryptography）** を `EncryptedTextField` でラップ。鍵は `BOMOPS_ENCRYPTION_KEY`（未設定時は SECRET_KEY 由来）。**鍵はデータ暗号化後に変更不可** |
| フロント | **React 19 + TypeScript + Vite**（`frontend/web/`）。API型は openapi-typescript で自動生成（手書き禁止） |
| 非同期/ジョブ | （TODO: Celery + Redis 想定） |
| デプロイ | **GCP（Cloud Run + Cloud SQL + Firebase Hosting + Secret Manager）**。検証環境は稼働中（SPA: https://baiten-gcp.web.app / API: Cloud Run `bomops-api` asia-northeast1）。選定根拠 `docs/DOC-IF-001`、手順 `docs/gcp-deploy.md`。※リテール事業系はGCP方針（`aws` スキルは fieldup 用であり本プロジェクトでは使わない） |

> バックエンド設計判断は `backend-architect` スキル、AWS運用は `aws` スキルを参照。
> 本番化前の残課題：IAP（Workspace SSO）前段追加・DBティア引き上げ・CI/CD・admin初期パスワード変更。

### 実装状況（2026-06 時点）
- バックエンドは単一 `bom` アプリに集約（13モデル / 約30エンドポイント）。設定は `config.settings`（開発）/ `config.settings_prod`（本番）/ `config.settings_sqlite`（テスト・PostgreSQL不要環境）。
- Notion 実データ取り込み済み（`manage.py import_notion`）。本番 Cloud SQL に 部品マスタ31 / 顧客10 / 拠点20 / セット46 / 実物146 を投入済み。
- ソースツリーは `bomops/` → **`bomops_core/`** にリネーム済み（`Dockerfile` / `docker-compose.yml` / `scripts/gcp/*.sh` の `manage.py` 参照も `bomops_core/` へ対応済み）。

### よく使うコマンド
```bash
# 開発サーバ（manage.py は bomops_core/ 配下）
python bomops_core/manage.py runserver
# マイグレーション
python bomops_core/manage.py makemigrations && python bomops_core/manage.py migrate
# テスト（PostgreSQL未起動なら sqlite 設定で）
pytest                              # or: python bomops_core/manage.py test bom
pytest --ds=config.settings_sqlite
# Notion 実データ取り込み（冪等・自然キーで upsert）
python bomops_core/manage.py import_notion --dir ../from_notion/extracts --dry-run
# 実セット構成から製品BOMレシピを導出（冪等）
python bomops_core/manage.py derive_bom --dry-run
# lint / format
ruff check . && ruff format .
```

---

## 3. ドメインモデル（正準スキーマ）

> **出典**：本スキーマは Notion「L4 BAITENサービス管理」の既存DB群（BAITENサービス管理 / Product Set / Parts / BOM）から正規化して導出した正準スキーマである。BAITEN STAND を最初の実装ターゲットとするが、モデルは汎用デバイス（AIカメラ・ロッカー・IoT-GW）へ拡張可能に保つこと。

### 3.1 レイヤと主要エンティティ

**Structure Layer（構造）**
- `PartMaster` — 部品仕様/型番マスタ（旧 Notion "BAITEN BOM"）
- `Unit` — 実物部品。シリアル単位の物理インスタンス（旧 "BAITEN Parts"）
- `DeviceSet` — 1台構成の完成品セット（旧 "BAITEN Product Set"）

**Configuration Layer（設定）**
- `Site` — 設置拠点/店舗（旧 "BAITENサービス管理" の拠点側を分離）
- `SiteConfig` — 拠点固有のクレデンシャル/設定（POS・決済・NW・env、サービス管理のシークレット側を分離）

**Operations Layer（運用）**
- `LifecycleStatus`（enum）— 稼働状態
- `MaintenanceEvent` — 故障/交換/保守の追記型履歴（**新規**。Notionには未整備のため新設）
- `DeployEvent` — 設置/開通/回収等のオペレーション履歴（**新規**）

**External / Reference**
- `Organization` — 設置主体（旧 "AIBOD Entity"。外部マスタ参照）
- `EquipmentRef` — L4 機器管理DB との連携参照（N:M）

### 正準スキーマ ⇔ 実装（`bom/models.py`）の対応表

実装は本スキーマより先行して着手されたため、以下の名前で実装されている。
**概念上は本スキーマの定義に従うこと**（リネームは将来のリファクタリングで検討）。

| 正準スキーマ | 実装モデル | 備考 |
|------|------|------|
| `Organization` | `Customer` | `entity_num` は未実装 |
| `Site` | `CustomerSite` | `lifecycle_status` 実装済み |
| `SiteConfig` | `SiteConfig` | 1:1、secret系は `EncryptedTextField` で暗号化・APIマスク |
| `DeviceSet` | `BssSet` | 実装は `ProductModel`/`ProductBOM`（型番・レシピ層）を追加で持つ。ProductModel は **ファミリ（`ProductFamily`マスタFK・nullable）→ グレード → バリエーション → モデル** の4層分類（grade/variation は暫定的に自由文字列。整備後にマスタ昇格を検討） |
| `Unit` | `PartUnit` | Identity = `serial_number` |
| `PartMaster` | `PartMaster` | 正準の category（本体構成品/オプション品/組立部品/その他）は `part_group`（主要/周辺/組立/その他）として実装。正準の type（種別）は `category` = **`PartCategory` マスタへのFK**（画面から追加可能・使用中削除はPROTECT）。「どの製品で使うか」は旧 `used_in_ai`/`used_in_mini` フラグを廃止し **`ProductBOM` 関係から導出**（API: `used_in` / フィルタ: `used_in_model`・`used_in_family`・`used_in_grade`） |
| `MaintenanceEvent` | `MaintenanceEvent` | 追記型（API/Adminとも更新・削除不可） |
| `DeployEvent` | `DeployEvent` | 追記型（API/Adminとも更新・削除不可） |
| `EquipmentRef` | `EquipmentRef` | `PartUnit` と N:M |
| `UnitSlotAssignment` | `BssSetComponent` | `role` がスロットコード相当。搭載/取外し履歴も保持 |

### 3.2 正準ER図（正規化後）

```mermaid
erDiagram
    Organization ||--o{ Site : "設置主体"
    Site ||--|| SiteConfig : "1:1 設定"
    Site ||--o{ DeviceSet : "1拠点に複数台"
    DeviceSet ||--o{ Unit : "セット=実機の集合"
    PartMaster ||--o{ Unit : "型番→実機(1:N)"
    DeviceSet ||--o{ MaintenanceEvent : "保守履歴"
    DeviceSet ||--o{ DeployEvent : "導入履歴"
    Unit }o--o{ EquipmentRef : "機器⇔部品(N:M)"

    Organization {
        uuid id PK
        string entity_num "AIBOD Entity番号(外部)"
        string name
    }
    Site {
        uuid id PK
        string location "拠点/店舗名"
        enum  lifecycle_status "準備中/稼働中/撤退済/拠点/貸出中"
        fk    organization_id FK
    }
    SiteConfig {
        uuid id PK
        fk   site_id FK "1:1"
        string loyverse_account
        string loyverse_store_id
        secret loyverse_token
        string square_account
        string squ_device_id
        string squ_location_id
        secret squ_token
        secret paypay_secret
        secret baiten_cloud_key
        secret google_secret
        secret slack_bot_token
        text  config_toml
        text  baiten_env
    }
    DeviceSet {
        uuid id PK
        string set_name
        enum  model "BAITEN AI/Mini/stock/出張中/転用中"
        date  shipped_at "出荷日"
        fk    site_id FK "nullable(在庫時)"
    }
    Unit {
        uuid id PK
        string part_name
        string serial_no "S/N (Identity)"
        enum  defect_status "OK/不良"
        enum  utilization_target "R4/R5/NA..."
        date  checked_at
        date  purchased_at
        fk    device_set_id FK "nullable"
        fk    part_master_id FK
    }
    PartMaster {
        uuid id PK
        string item "型番/部品名"
        enum  category "本体構成品/オプション品/組立部品/その他"
        enum  type "MiniPC/PayDevice/カメラ/モニター/Barcode..."
        string provider
        text  spec "仕様"
        text  size "サイズ"
        bool  used_in_ai "AI使用"
        bool  used_in_mini "Mini使用"
    }
    MaintenanceEvent {
        uuid id PK
        fk   device_set_id FK
        fk   unit_id FK "対象実機(nullable)"
        enum event_type "故障/交換/点検/設定変更"
        text note
        datetime occurred_at
    }
    DeployEvent {
        uuid id PK
        fk   device_set_id FK
        enum stage "設置/開通/稼働/回収/再組立"
        datetime occurred_at
    }
    EquipmentRef {
        uuid id PK
        string external_id "L4 機器管理DB(183e91a9)"
    }
```

### 3.3 リレーション基数（要点）
- `Organization 1—N Site`：1つの設置主体が複数拠点を持つ。
- `Site 1—1 SiteConfig`：拠点とその設定は1:1（**Notionでは1テーブル混在 → 正規化で分離**）。
- `Site 1—N DeviceSet`：1拠点に複数の完成品。`DeviceSet.site` は在庫/出張中で null 可。
- `DeviceSet 1—N Unit`：セットは複数実機部品で構成。
- `PartMaster 1—N Unit`：型番1件に対し実機N台（**Identity = serial_no**）。
- `Unit N—M EquipmentRef`：実機と外部機器管理の多対多。

---

## 4. 正規化に関する重要な設計判断

Claude Code が既存Notion構造をそのまま写経しないよう、以下の決定を**正準とする**。

1. **サービス管理DBの分割**：Notionの "BAITENサービス管理" は「拠点マスタ」と「クレデンシャル/設定」が混在していた。これを `Site`（業務属性）と `SiteConfig`（機密・設定）に **必ず分離** する。`SiteConfig` の token/secret 系は暗号化フィールド（例：`django-fernet-fields` 相当）で保持し、APIレスポンスにマスクして返すこと。

2. **HWスロットの正規化**：Notionで `CAM / ARM / DARM / DIS / ENC / LTE / POE ...` を multi-select タグで持っていたが、これらは本来 **実機(`Unit`)への参照** である。文字列タグで複製せず、`Unit`（`PartMaster.type` で種別判定）への FK/中間関係で表現する。スロットの「位置」を持たせたい場合は中間テーブル `UnitSlotAssignment(device_set, unit, slot_code)` を新設する。

3. **履歴は追記型（イベントソーシング寄り）**：交換・設定変更・代替部品は `MaintenanceEvent` / `DeployEvent` として追記する。`Unit` や `SiteConfig` を上書きするだけで履歴を失わせない。これが Dynamic BOM の本質。

4. **Identity = serial_no**：`Unit.serial_no` を装置トレーサビリティの一次キー的識別子として扱う（DB上のPKはUUIDだが、業務的同一性はS/Nで判断）。

5. **独立DBの扱い**：Notionの "L5 BAITEN SQUARE DB"（POS/決済端末台帳）と "L5 部品仕様DB"（メモ）はリレーションを持たない独立テーブルだった。SQUARE台帳は `PartMaster`(type=PayDevice) または専用 `PaymentTerminal` への統合を検討し、メモ系は `PartMaster.spec` に吸収する。安易に独立テーブルを温存しない。

---

## 5. ディレクトリ構成（実態）

```
bomops_core/             # Django プロジェクトルート（旧 bomops/）
  config/                # settings(.py / _prod / _sqlite), urls, wsgi/asgi
  bom/                   # 単一アプリに全モデルを集約
    models.py            #   13モデル（構造/設定/運用/外部連携）
    fields.py            #   EncryptedTextField（Fernet 暗号化）
    serializers.py       #   secret系は to_representation でマスク
    views.py             #   ViewSet + 追記型(AppendOnly) + カスタムAPI
    pagination.py / exceptions.py
    management/commands/import_notion.py   # Notion 実データ取り込み
    migrations/ tests.py admin.py urls.py
  manage.py
  templates/
frontend/web/            # React + Vite SPA（Workspace / Dashboard）。手順は frontend/web/README.md
domain_gateway/          # 空プレースホルダ（DOC-PF-001 の Domain Intelligence Gateway 用・未実装）
ops_gateway/             # 空プレースホルダ（同 Ops Gateway 用・未実装）
scripts/gcp/             # setup.sh / deploy.sh / create-superuser.sh / deploy-frontend.sh
docs/                    # 設計・選定・デプロイ・OpenAPI ドキュメント
```

> 現状は三層（structure / configuration / operations）を**単一 `bom` アプリ内のモデル区分**として表現している（§3.1 のコメント区切り参照）。アプリ分割は将来のリファクタリング検討事項。Domain Gateway 等の新ドメイン機能は `domain_gateway/`・`ops_gateway/` 配下に置く（§1 プラットフォーム構想・DOC-PF-001）。

---

## 6. コーディング規約・運用ルール

- **モデル変更時**：必ず `makemigrations` を伴うこと。スキーマ変更は本ファイル §3 のER図も同時更新する（ドキュメントとDBの乖離を作らない）。
- **機密情報**：token / secret / cloud key は平文でコミットしない。`.env` / Secrets Manager 経由。テストにも実キーを入れない。
- **API**：DRF ViewSet + Router を基本。リスト系は拠点(`Site`)・セット(`DeviceSet`)・実機(`Unit`)で横断検索できることを優先。
- **テスト**：モデルのリレーション基数とライフサイクル遷移（準備中→稼働中→撤退済 等）にテストを書く。履歴追記が上書きで消えないことを必ず検証。
- **日本語**：UIラベル・enumの表示名は日本語可。コード上の識別子（モデル/フィールド名）は英語。enum値の対応表は本ファイルを正とする。

---

## 7. 関連スキル / ドキュメント

### プロジェクト内ドキュメント（`docs/`）
| ドキュメント | 内容 |
|------|------|
| `DOC-PF-001_bomops_platform_initial.md` | BOMOps Platform 構想 v0.1（Asset Core + Domain Gateway + Ops Gateway + Workcode + DIO の5層） |
| `DOC-APP-001_baiten_commerce_gateway.md` | BAITEN Commerce Gateway v0.3（Loyverse連携・業者別売上・委託手数料・自動精算） |
| `DOC-FE-001_bomops_frontend_plan.md` | フロントエンド（Workspace / Dashboard）設計 |
| `DOC-IF-001_cloud_selection_gcp_aws.md` | GCP vs AWS 選定根拠 |
| `gcp-deploy.md` | GCP デプロイ手順 |
| `openapi.yaml` / `erchart.mmd` | OpenAPI スキーマ / ER図 |

### スキル
- AIBOD設計原則（過剰設計回避・縦串維持・既存リソース優先）：`aibod-design-philosophy` スキル。
- バックエンド設計：`backend-architect` / AWS運用：`aws` スキル。
- 電池循環事業（BCH/BIE = 将来の Battery Intelligence Gateway）：`bch-platform` スキル。
- 出典Notion: L4 BAITENサービス管理 `57fc96ba1b7c4d569307f981832b5770`

---

## 8. 用語集（Glossary）

| 用語 | 定義 |
|------|------|
| **BOMOps** | Structure×Configuration×Operations を1装置単位で統合する Dynamic BOM Platform |
| **Dynamic BOM** | 製造後の交換・更新・設定変更まで「構成の時間軸」を扱うBOM |
| **Set Twin** | 1セット=1台の完全なデジタルツイン（構成・拠点・設定・履歴・稼働） |
| **DeployOps** | 設置〜回収〜再組立までの現場オペレーションとデータ統合 |
| **Identity** | 実機シリアル(`Unit.serial_no`)による同一性 |
| **Lifecycle** | 装置/拠点の時系列ステータス遷移と履歴 |
| **DeviceSet** | 1台構成の完成品（旧 BAITEN Product Set） |
| **Unit** | シリアル単位の実物部品（旧 BAITEN Parts） |
| **PartMaster** | 型番/部品仕様マスタ（旧 BAITEN BOM） |
| **Site / SiteConfig** | 拠点マスタ / 拠点固有設定（旧 BAITENサービス管理を分離） |
