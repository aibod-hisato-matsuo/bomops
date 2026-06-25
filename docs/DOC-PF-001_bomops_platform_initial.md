# BOMOps Platform v0.1

## AIBOD Physical AX 共通運用プラットフォーム構想

## 1. 位置づけ

BOMOps Platform は、AIBODが扱う「実体物を伴う事業」を共通の構造で管理・運用するための基盤である。

対象は、BAITEN STAND、Battery Circular Hub / Battery Intelligence Engine、FactoryOS、設備監視、物流・在庫管理などである。

BOMOps Platform は、単なるBOM管理ではなく、以下を統合する。

* 実体物の構成情報
* 設置・配置・所有・接続情報
* 運用ログ
* ドメイン固有の診断・評価・判断
* 業務タスク
* 売上・精算・契約・保守などの業務処理

---

## 2. 基本思想

AIBODが扱う事業には、共通して以下の流れがある。

```text
実体物
  ↓
構成情報
  ↓
設置・接続情報
  ↓
運用ログ
  ↓
診断・評価
  ↓
業務判断
  ↓
実行・改善
```

BOMOps Platform は、この流れを共通アーキテクチャとして扱う。

---

## 3. 全体アーキテクチャ

```text
BOMOps Platform
 ├─ Asset Core
 │   └─ 静的構成情報・台帳・契約・接続情報
 │
 ├─ Domain Intelligence Gateway
 │   └─ ドメイン固有の評価・診断・商流処理
 │
 ├─ Ops Gateway
 │   └─ 監視・ログ・状態・イベント・保守履歴
 │
 ├─ Workcode Connector
 │   └─ 業務定義・タスク化・運用フロー
 │
 └─ DIO Connector
     └─ Detect / Forecast / Plan / Execute / Evaluate
```

---

## 4. 各レイヤーの役割

## 4.1 Asset Core

静的・準静的な情報を管理する。

### 主な情報

* 実体物ID
* BOM / 部品構成
* 型番
* 製造番号
* 所有者
* 設置場所
* 接続情報
* 契約情報
* 保守情報
* 外部サービス認証情報
* 設備・端末・モジュール構成

### 役割

```text
その対象が何で構成され、どこにあり、誰に紐づき、何に接続されているか
```

を管理する。

---

## 4.2 Domain Intelligence Gateway

ドメイン固有の業務・評価・判断を処理する。

BAITENでは Commerce Gateway。
BCH/BIEでは Battery Intelligence Gateway。
FactoryOSでは Factory Intelligence Gateway となる。

### 主な役割

* 商品・売上・精算
* 電池診断・SOH推定・グレーディング
* 工程評価・設備評価
* 在庫評価
* 出口判定
* 収益計算
* ドメイン固有API

---

## 4.3 Ops Gateway

動的な運用情報を管理する。

### 主な情報

* 稼働ログ
* 通信ログ
* エラーログ
* センサーログ
* 状態監視
* 障害イベント
* 保守履歴
* アラート
* 現場オペレーション履歴

### 役割

```text
その対象が日々どう動き、どこで異常が起き、どう保守されたか
```

を管理する。

---

## 4.4 Workcode Connector

BOMOps上のイベントや状態を、業務タスクに変換する。

### 例

* 売上締め処理
* 精算承認
* 商品更新
* 端末障害対応
* 電池診断実施
* 再評価依頼
* 保守訪問
* 出荷判定

---

## 4.5 DIO Connector

運用データをDIOの処理ステップに接続する。

```text
Ingest
Normalize
Feature
Detect
Forecast
Plan
Schedule
Execute
Evaluate
```

BOMOps Platform は、DIOが動くための実体情報・運用情報・業務文脈を提供する。

---

# 5. BAITEN STANDへの適用

## 5.1 Asset Core

```text
BAITEN STAND個体
 ├─ 筐体
 ├─ Mini PC / Raspberry Pi
 ├─ カメラ
 ├─ タッチパネル
 ├─ バーコードリーダー
 ├─ Square端末
 ├─ PayPay接続情報
 ├─ Loyverse SHOP_ID
 ├─ 設置店舗
 └─ 保守契約
```

## 5.2 Domain Intelligence Gateway

```text
BAITEN Commerce Gateway
 ├─ 商品マスタ
 ├─ 店舗タグ
 ├─ 業者タグ
 ├─ 売上同期
 ├─ 商品予約更新
 ├─ 業者別売上
 ├─ 手数料計算
 └─ 自動精算
```

## 5.3 Ops Gateway

```text
BAITEN Ops Gateway
 ├─ 端末稼働状態
 ├─ 通信状態
 ├─ 決済端末状態
 ├─ アプリログ
 ├─ 同期エラー
 ├─ カメラ状態
 └─ 保守イベント
```

---

# 6. BCH/BIEへの適用

## 6.1 Asset Core

```text
Battery Asset
 ├─ Pack
 ├─ Module
 ├─ Cell
 ├─ メーカー
 ├─ 型番
 ├─ 製造番号
 ├─ 化学組成
 ├─ 公称容量
 ├─ 使用履歴
 ├─ 所有者
 ├─ 保管場所
 └─ 検査履歴
```

## 6.2 Domain Intelligence Gateway

```text
Battery Intelligence Gateway
 ├─ 診断結果
 ├─ SOH推定
 ├─ SOC状態
 ├─ 劣化予測
 ├─ インピーダンス評価
 ├─ セルグレーディング
 ├─ 再利用用途判定
 ├─ 出口提案
 └─ 価値評価
```

## 6.3 Ops Gateway

```text
Battery Ops Gateway
 ├─ 充放電ログ
 ├─ 温度ログ
 ├─ BMSログ
 ├─ BMUログ
 ├─ 検査装置ログ
 ├─ 保管環境ログ
 ├─ 異常イベント
 └─ 再検査履歴
```

---

# 7. 対応表

| 概念             | BAITEN STAND        | BCH/BIE                      |
| -------------- | ------------------- | ---------------------------- |
| 実体物            | セルフレジ端末             | Pack / Module / Cell         |
| Asset Core     | 端末構成・SHOP_ID・決済接続情報 | 電池構成・型番・化学組成・履歴              |
| Domain Gateway | Commerce Gateway    | Battery Intelligence Gateway |
| Domain Data    | 商品・売上・精算            | 診断・SOH・劣化・出口判定               |
| Ops Gateway    | 稼働監視・障害ログ           | 充放電ログ・BMSログ・温度ログ             |
| Workcode       | 精算・商品更新・保守          | 検査・診断・再評価・出荷判定               |
| DIO            | 売上検知・補充計画           | 劣化検知・寿命予測・用途計画               |

---

# 8. BOMOps Platformの本質

BOMOps Platform の本質は、以下である。

```text
実体物の構成を管理する
    ↓
実体物の運用を記録する
    ↓
ドメイン固有の価値判断を行う
    ↓
業務タスクに変換する
    ↓
継続的に改善する
```

つまり、BOMOps Platform は、AIBODのPhysical AXにおける共通運用OSである。

---

# 9. 今後の拡張

## v0.2候補

* 共通Asset Schema
* Domain Gateway共通I/F
* Ops Event Schema
* Workcode連携仕様
* DIO 9ステップ対応
* BAITEN版実装仕様
* BCH/BIE版実装仕様

## v0.3候補

* Device Registry
* Contract Registry
* Settlement Engine
* Diagnosis Engine
* Maintenance Engine
* AI Agent連携
* Dashboard統合

---

# 10. まとめ

BOMOps Platform は、BAITEN STANDだけの管理基盤ではない。

AIBODが扱う、実体物を持つ事業すべてに適用できる共通プラットフォームである。

BAITENでは、商品・売上・精算を扱う。
BCH/BIEでは、電池診断・劣化推定・再利用判断を扱う。
FactoryOSでは、設備・工程・稼働・品質を扱う。

これらはすべて、同じ骨格で整理できる。

```text
Asset Core
 + Domain Intelligence Gateway
 + Ops Gateway
 + Workcode
 + DIO
```

この構成により、BOMOps Platform は、AIBODの事業群を支える共通のPhysical AX基盤となる。
