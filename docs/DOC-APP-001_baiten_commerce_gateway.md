# BAITEN Commerce Gateway v0.3

## BOMOps連携・売上自動精算 仕様案

## 1. 位置づけ

BAITEN Commerce Gateway v0.3 は、LoyverseをPOS実務基盤として利用しながら、BAITEN STANDの複数店舗・複数業者・複数商品の商流を統合管理するための中間基盤である。

v0.2では、商品マスタ、店舗タグ、業者タグ、売上ラベル、商品予約更新をGateway側で管理した。

v0.3では、さらに以下を追加する。

* BOMOpsとの商品・業者・店舗・契約情報連携
* 業者別売上の自動集計
* 委託販売手数料の自動計算
* 締日単位の精算レポート生成
* 支払予定・振込管理
* BAITEN STAND運営全体の収益可視化

これにより、BAITEN STANDは単なるセルフレジではなく、地域内の小規模売場・委託販売・無人販売を束ねる商流管理基盤となる。

---

## 2. コンセプト

### 2.1 Loyverseの役割

Loyverseは以下に限定する。

* POS会計
* レシート発行
* 税区分管理
* 基本的な商品表示
* 売上発生記録

### 2.2 BAITEN Commerce Gatewayの役割

Gatewayは以下を担当する。

* 商品正本管理
* 店舗別商品展開管理
* 業者別商品管理
* 売上データ正規化
* 業者別売上集計
* 手数料計算
* 精算レポート生成
* BOMOps連携

### 2.3 BOMOpsの役割

BOMOpsは、BAITEN STAND運営における業務・契約・商流情報の正本を管理する。

* 業者マスタ
* 店舗マスタ
* 商品マスタ
* 契約条件
* 精算条件
* 手数料体系
* 支払先情報
* 業務フロー定義

---

## 3. 全体アーキテクチャ

```text
[ BAITEN STAND Terminal ]
        │
        │ 商品取得・販売
        ▼
[ Loyverse ]
        │
        │ 売上・レシート同期
        ▼
[ BAITEN Commerce Gateway ]
        │
        ├─ 商品マスタ管理
        ├─ 店舗・業者ラベル管理
        ├─ 売上正規化
        ├─ 精算計算
        └─ レポート生成
        │
        ▼
[ BOMOps ]
        │
        ├─ 業者情報
        ├─ 契約条件
        ├─ 支払条件
        ├─ 商品/店舗対応
        └─ 業務タスク管理
```

---

## 4. v0.3で追加する主要機能

## 4.1 BOMOps Connector

BOMOpsとGatewayを連携するためのアダプタ。

### 連携対象

| 対象   | BOMOps側                | Gateway側          |
| ---- | ---------------------- | ----------------- |
| 業者   | supplier / vendor      | organization      |
| 店舗   | sales_location / store | store_master      |
| 商品   | product / item         | item_master       |
| 契約   | contract / agreement   | supplier_contract |
| 手数料  | commission_rule        | settlement_rule   |
| 精算条件 | payment_terms          | settlement_cycle  |

---

## 4.2 業者マスタ

```text
supplier_master
```

| 項目                 | 説明                 |
| ------------------ | ------------------ |
| supplier_id        | 業者ID               |
| bomops_supplier_id | BOMOps側ID          |
| name               | 業者名                |
| supplier_type      | 委託販売 / 仕入販売 / 自社商品 |
| invoice_number     | インボイス番号            |
| contact_name       | 担当者                |
| email              | 通知先                |
| bank_account_id    | 振込先                |
| is_active          | 有効状態               |

---

## 4.3 契約・手数料ルール

```text
supplier_contract
```

| 項目                      | 説明                            |
| ----------------------- | ----------------------------- |
| contract_id             | 契約ID                          |
| supplier_id             | 業者ID                          |
| contract_type           | consignment / wholesale / own |
| start_date              | 契約開始日                         |
| end_date                | 契約終了日                         |
| settlement_cycle        | 月末締め / 15日締め / 週次など           |
| payment_due_rule        | 翌月末払い等                        |
| default_commission_rate | 基本手数料率                        |
| tax_handling            | 税込精算 / 税抜精算                   |
| status                  | active / suspended / expired  |

---

## 4.4 商品別手数料ルール

商品ごとに手数料を変える場合に利用する。

```text
item_commission_rule
```

| 項目              | 説明                    |
| --------------- | --------------------- |
| rule_id         | ルールID                 |
| supplier_id     | 業者ID                  |
| item_id         | 商品ID                  |
| store_id        | 対象店舗                  |
| commission_type | rate / fixed / hybrid |
| commission_rate | 手数料率                  |
| fixed_fee       | 固定手数料                 |
| effective_from  | 適用開始                  |
| effective_to    | 適用終了                  |
| priority        | 優先順位                  |

### 例

```json
{
  "supplier_id": "SUP-001",
  "item_id": "ITEM-BENTO-001",
  "store_id": "STORE-FH01",
  "commission_type": "rate",
  "commission_rate": 0.15,
  "effective_from": "2026-07-01"
}
```

---

## 4.5 売上ラベル付け

Loyverseから同期した売上明細に対して、Gateway側で以下を付与する。

```text
sales_line
```

| 項目                | 説明                         |
| ----------------- | -------------------------- |
| sales_line_id     | 売上明細ID                     |
| receipt_id        | LoyverseレシートID             |
| store_id          | 販売店舗                       |
| region_id         | 地域                         |
| item_id           | 商品                         |
| supplier_id       | 納入業者                       |
| quantity          | 数量                         |
| gross_sales       | 税込売上                       |
| net_sales         | 税抜売上                       |
| tax_amount        | 消費税                        |
| commission_amount | BAITEN手数料                  |
| supplier_amount   | 業者支払額                      |
| aibod_revenue     | AIBOD収益                    |
| settlement_status | unsettled / settled / paid |

---

## 5. 売上自動精算

## 5.1 精算処理の流れ

```text
Loyverse売上同期
    ↓
Gateway売上正規化
    ↓
店舗・業者・商品ラベル付け
    ↓
契約条件取得
    ↓
手数料計算
    ↓
精算期間ごとに集計
    ↓
精算書生成
    ↓
業者確認
    ↓
支払予定化
    ↓
支払完了登録
```

---

## 5.2 精算計算ロジック

基本式：

```text
業者支払額 = 売上金額 - BAITEN手数料 - その他控除
```

手数料率方式：

```text
BAITEN手数料 = 売上金額 × 手数料率
```

固定手数料方式：

```text
BAITEN手数料 = 販売数量 × 固定手数料
```

ハイブリッド方式：

```text
BAITEN手数料 = 売上金額 × 手数料率 + 販売数量 × 固定手数料
```

---

## 5.3 settlement_header

精算単位のヘッダ。

| 項目                | 説明                                  |
| ----------------- | ----------------------------------- |
| settlement_id     | 精算ID                                |
| supplier_id       | 業者ID                                |
| region_id         | 地域                                  |
| period_from       | 精算開始日                               |
| period_to         | 精算終了日                               |
| gross_sales       | 総売上                                 |
| tax_amount        | 消費税                                 |
| commission_amount | 手数料                                 |
| adjustment_amount | 調整額                                 |
| supplier_payable  | 業者支払額                               |
| status            | draft / confirmed / approved / paid |
| generated_at      | 生成日時                                |
| approved_at       | 承認日時                                |
| paid_at           | 支払完了日時                              |

---

## 5.4 settlement_line

商品別・店舗別の精算明細。

| 項目                 | 説明    |
| ------------------ | ----- |
| settlement_line_id | 明細ID  |
| settlement_id      | 精算ID  |
| store_id           | 店舗    |
| item_id            | 商品    |
| quantity           | 販売数量  |
| gross_sales        | 税込売上  |
| net_sales          | 税抜売上  |
| commission_amount  | 手数料   |
| supplier_payable   | 業者支払額 |

---

## 5.5 adjustment

手動調整用。

例：

* 返品
* 破損
* 廃棄
* サンプル提供
* 振込手数料
* キャンペーン補填
* 業者個別調整

```text
settlement_adjustment
```

| 項目              | 説明                             |
| --------------- | ------------------------------ |
| adjustment_id   | 調整ID                           |
| settlement_id   | 精算ID                           |
| adjustment_type | refund / damage / fee / manual |
| amount          | 調整金額                           |
| reason          | 理由                             |
| created_by      | 登録者                            |
| approved_by     | 承認者                            |

---

## 6. BOMOps連携モデル

## 6.1 BOMOps側に持つべき情報

BOMOpsでは、BAITEN運営を以下の構造で管理する。

```text
BAITEN Operation
 ├─ Region
 ├─ Store
 ├─ Terminal
 ├─ Supplier
 ├─ Product
 ├─ Contract
 ├─ Settlement Rule
 ├─ Settlement Task
 └─ Payment Task
```

---

## 6.2 Workcode連携

精算業務をWorkcodeとして定義する。

### 例：BAITEN精算フロー

| Workcode                         | タスク    |
| -------------------------------- | ------ |
| E-9500-BAITEN-SALES-SYNC         | 売上同期   |
| E-9500-BAITEN-SALES-CHECK        | 売上確認   |
| F-9600-BAITEN-SETTLEMENT-GEN     | 精算書生成  |
| F-9600-BAITEN-SETTLEMENT-APPROVE | 精算承認   |
| F-9600-BAITEN-PAYMENT-SCHEDULE   | 支払予定作成 |
| F-9600-BAITEN-PAYMENT-DONE       | 支払完了登録 |

---

## 6.3 BOMOpsへのイベント通知

Gatewayは主要イベントをBOMOpsへ通知する。

| イベント                 | 説明     |
| -------------------- | ------ |
| sales_synced         | 売上同期完了 |
| settlement_generated | 精算書生成  |
| settlement_approved  | 精算承認   |
| payment_scheduled    | 支払予定作成 |
| payment_completed    | 支払完了   |

イベント例：

```json
{
  "event_type": "settlement_generated",
  "supplier_id": "SUP-001",
  "settlement_id": "SET-202607-SUP001",
  "period_from": "2026-07-01",
  "period_to": "2026-07-31",
  "supplier_payable": 182300
}
```

---

## 7. API追加仕様

## 7.1 業者別売上一覧

```http
GET /api/v1/sales/by-supplier
```

### Query

```text
from
to
supplier_id
store_id
region_id
```

### Response

```json
{
  "supplier_id": "SUP-001",
  "supplier_name": "業者A",
  "gross_sales": 250000,
  "commission_amount": 37500,
  "supplier_payable": 212500
}
```

---

## 7.2 精算書生成

```http
POST /api/v1/settlements/generate
```

### Request

```json
{
  "period_from": "2026-07-01",
  "period_to": "2026-07-31",
  "supplier_ids": ["SUP-001", "SUP-002"],
  "region_id": "REG-FH"
}
```

### Response

```json
{
  "generated_count": 2,
  "settlements": [
    {
      "settlement_id": "SET-202607-SUP001",
      "supplier_id": "SUP-001",
      "status": "draft",
      "supplier_payable": 182300
    }
  ]
}
```

---

## 7.3 精算書確認

```http
GET /api/v1/settlements/{settlement_id}
```

---

## 7.4 精算承認

```http
POST /api/v1/settlements/{settlement_id}/approve
```

---

## 7.5 支払完了登録

```http
POST /api/v1/settlements/{settlement_id}/mark-paid
```

### Request

```json
{
  "paid_at": "2026-08-31",
  "payment_method": "bank_transfer",
  "payment_reference": "振込IDまたはメモ"
}
```

---

## 7.6 BOMOps同期

```http
POST /api/v1/bomops/sync
```

同期対象：

```json
{
  "targets": [
    "suppliers",
    "stores",
    "items",
    "contracts",
    "settlement_rules"
  ]
}
```

---

## 8. 管理画面

v0.3で必要な管理画面。

## 8.1 業者管理

* 業者一覧
* インボイス番号
* 振込先
* 契約状態
* 取扱商品数
* 未精算金額

## 8.2 商品・業者マッピング

* 商品一覧
* 取扱店舗
* 納入業者
* 手数料率
* 適用開始日
* Loyverse同期状態

## 8.3 売上確認

* 日別売上
* 店舗別売上
* 業者別売上
* 商品別売上
* 異常値検出

## 8.4 精算管理

* 精算期間
* 業者別支払額
* 手数料額
* 調整額
* 承認状態
* 支払状態
* 精算書PDF出力

---

## 9. 精算書出力

精算書には以下を含める。

* 業者名
* 精算期間
* 店舗別売上
* 商品別売上
* 販売数量
* 総売上
* 消費税
* BAITEN手数料
* 調整額
* 支払予定額
* 支払予定日
* 備考

出力形式：

* PDF
* CSV
* Excel
* メール添付

---

## 10. MVPスコープ v0.3

### 必須

1. supplier_master
2. supplier_contract
3. item_commission_rule
4. sales_lineへのsupplier_id付与
5. 業者別売上集計
6. 精算書生成
7. 精算承認
8. 支払完了登録
9. BOMOpsとの業者・店舗・商品同期

### 後回し

* 業者ポータル
* 業者による精算確認
* 自動振込API連携
* インボイス制度完全対応
* 会計ソフト連携
* AIによる異常売上検知

---

## 11. 将来拡張 v0.4

v0.4では以下を検討する。

* 業者ポータル
* 精算書の自動メール送信
* freee / Money Forward連携
* 自動振込データ生成
* 商品補充依頼
* 売れ筋通知
* 業者別在庫アラート
* 店舗別商品最適化
* POS Adapter抽象化
* BAITEN OS化

---

## 12. まとめ

BAITEN Commerce Gateway v0.3は、Loyverseの弱点を補う中間サーバーではなく、BAITEN STANDの商流を管理する中核基盤である。

v0.3により、以下が実現できる。

* 小規模店舗を地域単位で束ねる
* 店舗別・業者別・商品別の売上を自動集計する
* 委託販売の精算を自動化する
* BOMOpsと連携し、契約・業務・支払まで一体管理する
* Loyverseへの依存をPOS機能に限定する
* 将来のPOS変更にも耐えられる

この構成により、BAITEN STANDは「セルフレジ」から「小規模商流を束ねる地域販売OS」へ進化する。
