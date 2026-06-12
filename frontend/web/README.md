# BOMOps Web Frontend

BOMOps の Workspace / Dashboard を提供する React SPA。

実装計画は `docs/DOC-FE-001_bomops_frontend_plan.md` を参照。

## 技術スタック

- React 19 + TypeScript + Vite
- React Router v7 / TanStack Query v5 / axios（JWTリフレッシュ対応）
- react-hook-form + zod
- API型は OpenAPI スキーマから自動生成（`src/api/schema.d.ts` — 手で編集しない）
- CSS Modules + AIBODデザイントークン（`src/index.css`）

## 開発手順

前提: Node.js >= 20（このマシンでは nodebrew: `export PATH="$HOME/.nodebrew/current/bin:$PATH"`）

```bash
npm install

# バックエンドを起動しておく（PostgreSQL なしの場合は sqlite 設定で）
# リポジトリルートで:
#   SQLITE_PATH=/tmp/bomops_dev.sqlite3 python3 bomops/manage.py migrate --settings=config.settings_sqlite
#   SQLITE_PATH=/tmp/bomops_dev.sqlite3 python3 bomops/manage.py runserver --settings=config.settings_sqlite

npm run dev          # http://localhost:5173 （/api は localhost:8000 へプロキシ）
```

## スクリプト

| コマンド | 内容 |
|---------|------|
| `npm run dev` | 開発サーバ（Vite。`/api` を Django にプロキシ） |
| `npm run build` | 型チェック＋本番ビルド |
| `npm run lint` | ESLint |
| `npm test` | Vitest ユニットテスト |
| `npm run test:watch` | Vitest（watchモード） |
| `npm run codegen` | 起動中のバックエンドから API 型を再生成 |
| `npm run codegen:local` | `docs/openapi.yaml` から API 型を再生成 |

バックエンドのAPIを変更したら、`python3 bomops/manage.py spectacular --file docs/openapi.yaml`
でスキーマを書き出し、`npm run codegen:local` で型を更新すること。

## ディレクトリ構成

```
src/
├── api/          # axios クライアント・自動生成型・クエリフック
├── auth/         # ログイン・認証コンテキスト・ルートガード
├── components/   # 共有UIコンポーネント（レイアウト等）
├── features/
│   ├── workspace/   # レコード作成・編集・検索・使用履歴
│   └── dashboard/   # 集計サマリー
└── index.css     # AIBODブランドのデザイントークン
```

## 実装状況

- P1 基盤（認証・ルーティング・型生成）: 完了
- P2 Workspace 読み取り画面（一覧・フィルタ・ページネーション・詳細）: 完了
- P3 Workspace 書き込み（フォーム・搭載/取外し・拠点設定・イベント追記）: 完了
- P4 検索・使用履歴（横断検索・シリアル逆引き・履歴タイムライン）: 完了
- P5 Dashboard（サマリーAPI・KPIカード・チャート・直近イベント）: 完了
- P6 仕上げ（接続状態表示・エラー統一・ユニットテスト）: 完了

## ネットワーク耐性（network-resilience 準拠）

- 3層検知: `navigator.onLine` イベント + APIクライアントの成功/失敗レポート
  （連続2回失敗で offline 判定）+ ヘルスチェック（`/api/v1/health/`、復帰時 + 5分毎）
- オフライン時は非ブロッキングバナーを表示（閲覧は継続可能）。復帰時は3秒間の復帰通知
- 読み取りエラーはトーストで通知（オフライン中はバナーが説明するため抑制、5秒スロットル）
- キャッシュ済みデータは TanStack Query が保持し、取得失敗時も直前のデータを表示し続ける
- 書き込みのオフラインキューイング（Outbox）は社内管理ツールの性質上、対象外とした
