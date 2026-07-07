/**
 * Workspace ホーム（データ関係マップ）
 *
 * 5つのデータセットを「マスタ（静的）」「運用（動的）」の2層に分け、
 * 派生・参照関係を矢印ラベルで可視化した入口ページ。
 * 各カードにはライブ件数を表示する（サマリーAPI）。
 */

import { Link } from 'react-router-dom'

import { useGet } from '../../api/hooks'
import type { DashboardSummary } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import styles from './WorkspaceHome.module.css'

function EntityCard({
  to,
  title,
  desc,
  count,
  countLabel,
}: {
  to: string
  title: string
  desc: string
  count?: string
  countLabel?: string
}) {
  return (
    <Link to={to} className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {count !== undefined && (
          <span className={styles.cardCount}>
            {count}
            {countLabel && <small> {countLabel}</small>}
          </span>
        )}
      </div>
      <p className={styles.cardDesc}>{desc}</p>
    </Link>
  )
}

/** 横方向の関係ラベル（→） */
function ArrowRight({ label }: { label: string }) {
  return (
    <div className={styles.hArrow} aria-hidden="true">
      <span className={styles.arrowLabel}>{label}</span>
      <span className={styles.arrowLine}>
        <span className={styles.arrowHeadRight} />
      </span>
    </div>
  )
}

/** 縦方向の関係ラベル（↓ / ↑） */
function ArrowVertical({ label, up = false }: { label: string; up?: boolean }) {
  return (
    <div className={styles.vArrow} aria-hidden="true">
      {up && <span className={styles.arrowHeadUp} />}
      <span className={styles.vArrowLine} />
      {!up && <span className={styles.arrowHeadDown} />}
      <span className={styles.arrowLabel}>{label}</span>
    </div>
  )
}

export function WorkspaceHome() {
  const { data: summary } = useGet<DashboardSummary>('/dashboard/summary/')

  const fmt = (n: number | undefined) => (n === undefined ? '…' : String(n))

  return (
    <div>
      <PageHeader
        title="ワークスペース"
        description="データの関係マップ — カードをクリックで各一覧へ"
      />

      <div className={styles.map}>
        {/* ===== マスタ層（静的）: 製品モデルが起点（BOMで部品を参照） ===== */}
        <section className={`${styles.band} ${styles.bandMaster}`}>
          <span className={styles.bandLabel}>マスタ（静的）</span>
          <div className={styles.bandRow}>
            <EntityCard
              to="/workspace/product-models"
              title="製品モデル"
              desc="製品型番とBOM構成表"
              count={fmt(summary?.product_models.total)}
              countLabel="型"
            />
            <ArrowRight label="BOMで部品を参照" />
            <EntityCard
              to="/workspace/part-masters"
              title="部品マスタ"
              desc="型番レベルの部品仕様"
              count={fmt(summary?.part_masters.total)}
              countLabel="種"
            />
          </div>
        </section>

        {/* ===== 層間の派生関係 ===== */}
        <div className={styles.connectorRow}>
          <ArrowVertical label="型番を選択" />
          <div />
          <ArrowVertical label="実物化 1:N（シリアル採番）" />
        </div>

        {/* ===== 運用層（動的） ===== */}
        <section className={`${styles.band} ${styles.bandOps}`}>
          <span className={styles.bandLabel}>運用（動的）</span>
          <div className={styles.bandRow}>
            <EntityCard
              to="/workspace/sets"
              title="製品セット"
              desc="完成機の構成・設定・イベント履歴"
              count={fmt(summary?.sets.total)}
              countLabel="台"
            />
            <ArrowRight label="実物を搭載" />
            <EntityCard
              to="/workspace/part-units"
              title="部品実物"
              desc="シリアル番号付き実物の在庫・状態"
              count={fmt(summary?.part_units.total)}
              countLabel="点"
            />
          </div>
          <div className={styles.bandRow}>
            <ArrowVertical label="設置 1:N" up />
            <div />
            <div />
          </div>
          <div className={styles.bandRow}>
            <EntityCard
              to="/workspace/customers"
              title="顧客・拠点"
              desc="設置先顧客と拠点・拠点設定"
              count={`${fmt(summary?.customers.total)} 社 / ${fmt(summary?.sites.total)}`}
              countLabel="拠点"
            />
            <div />
            <div />
          </div>
        </section>

        {/* ===== ユーティリティ ===== */}
        <Link to="/workspace/search" className={styles.searchCard}>
          <span className={styles.searchIcon} aria-hidden="true">🔍</span>
          <div>
            <h2 className={styles.cardTitle}>検索</h2>
            <p className={styles.cardDesc}>
              シリアル逆引き・横断検索・部品使用履歴 — すべての層を横断して探す
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
