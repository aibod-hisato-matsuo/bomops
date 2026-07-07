/**
 * Dashboard（P5 / 運用ダッシュボード改修）
 *
 * サマリーAPIのKPI・要対応パネル・状態別チャート・在庫組立可能数と
 * 直近イベントを表示する。KPIカード・チャートのバーは該当の
 * 絞り込み済み一覧へドリルダウンできる。60秒間隔で自動更新。
 */

import { Link, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useGet, useList } from '../../api/hooks'
import type {
  DashboardSummary,
  DeployEvent,
  MaintenanceEvent,
} from '../../api/types'
import { Badge } from '../../components/Badge'
import { DataTable, type Column } from '../../components/DataTable'
import { Section } from '../../components/DescList'
import { PageHeader } from '../../components/PageHeader'
import styles from './DashboardPage.module.css'

const AIBOD_SKY = '#00b3ec'

const setStatusLabels: Record<string, string> = {
  ASSEMBLED: '組立完了',
  INSTALLED: '設置済',
  REPAIR: '修理中',
  RECOVERED: '回収済',
  SCRAPPED: '廃棄',
}

const unitStatusLabels: Record<string, string> = {
  IN_STOCK: '在庫',
  ASSIGNED: '割当済',
  BROKEN: '故障',
  SCRAPPED: '廃棄',
}

const lifecycleLabels: Record<string, string> = {
  PREPARING: '準備中',
  ACTIVE: '稼働中',
  WITHDRAWN: '撤退済',
  BASE: '拠点',
  LOANED: '貸出中',
}

interface ChartDatum {
  key: string
  name: string
  count: number
}

function toChartData(
  counts: Record<string, number> | undefined,
  labels?: Record<string, string>,
): ChartDatum[] {
  // labels 指定時は enum キーを表示名に変換、未指定時はキー（名称）をそのまま使う
  const keys = labels ? Object.keys(labels) : Object.keys(counts ?? {})
  return keys
    .filter((key) => (counts?.[key] ?? 0) > 0)
    .map((key) => ({
      key,
      name: labels ? labels[key] : key,
      count: counts?.[key] ?? 0,
    }))
}

function StatusChart({
  data,
  onBarClick,
}: {
  data: ChartDatum[]
  onBarClick?: (key: string) => void
}) {
  if (data.length === 0) {
    return <p className={styles.chartEmpty}>データがありません</p>
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar
          dataKey="count"
          name="件数"
          fill={AIBOD_SKY}
          radius={[4, 4, 0, 0]}
          cursor={onBarClick ? 'pointer' : undefined}
          onClick={(entry) => {
            // recharts のクリックペイロードは payload に元データを持つ
            const datum = (entry as { payload?: ChartDatum }).payload
            if (datum?.key) onBarClick?.(datum.key)
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface RecentEvent {
  key: string
  occurred_at: string
  kind: '保守' | '導入'
  set_id: number
  set_code: string
  label: string
  note: string | null
}

const recentColumns: Column<RecentEvent>[] = [
  {
    key: 'occurred_at',
    header: '発生日時',
    render: (r) => r.occurred_at.slice(0, 16).replace('T', ' '),
  },
  {
    key: 'kind',
    header: '区分',
    render: (r) => (
      <Badge variant={r.kind === '保守' ? 'danger' : 'sky'}>{r.kind}</Badge>
    ),
  },
  {
    key: 'set_code',
    header: 'セット',
    render: (r) => (
      <Link className={styles.tableLink} to={`/workspace/sets/${r.set_id}`}>
        {r.set_code}
      </Link>
    ),
  },
  { key: 'label', header: '内容', render: (r) => r.label },
  { key: 'note', header: '備考', render: (r) => r.note ?? '-' },
]

/** KPIカード（クリックで該当一覧へドリルダウン） */
function KpiCard({
  label,
  value,
  to,
}: {
  label: string
  value: number | undefined
  to: string
}) {
  return (
    <Link to={to} className={styles.kpiCard}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value ?? '-'}</span>
    </Link>
  )
}

/** 要対応パネル（0件の項目は表示しない） */
function AttentionPanel({ summary }: { summary: DashboardSummary }) {
  const items = [
    {
      label: '修理中のセット',
      count: summary.sets.by_status?.REPAIR ?? 0,
      to: '/workspace/sets?status=REPAIR',
      hint: 'セット一覧（修理中）を開く',
    },
    {
      label: '故障している部品',
      count: summary.part_units.by_status?.BROKEN ?? 0,
      to: '/workspace/part-units?status=BROKEN',
      hint: '部品実物一覧（故障）を開く',
    },
    {
      label: '準備中の拠点',
      count: summary.sites.by_lifecycle_status?.PREPARING ?? 0,
      to: '/workspace/customers?tab=sites&lifecycle_status=PREPARING',
      hint: '拠点一覧（準備中）を開く',
    },
  ].filter((item) => item.count > 0)

  return (
    <Section title="要対応">
      {items.length === 0 ? (
        <div className={styles.attentionOk}>
          現在、対応が必要な項目はありません
        </div>
      ) : (
        <div className={styles.attentionGrid}>
          {items.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={styles.attentionCard}
              title={item.hint}
            >
              <span className={styles.attentionCount}>{item.count}</span>
              <span className={styles.attentionLabel}>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  )
}

/** 在庫組立可能数テーブル */
function StockCoverageTable({ summary }: { summary: DashboardSummary }) {
  const navigate = useNavigate()
  const columns: Column<DashboardSummary['stock_coverage'][number]>[] = [
    {
      key: 'model',
      header: '製品モデル',
      render: (r) => `${r.product_model_code}: ${r.product_model_name}`,
    },
    {
      key: 'buildable',
      header: '組立可能数',
      width: '110px',
      render: (r) => (
        <span
          className={
            r.buildable === 0 ? styles.buildableZero : styles.buildableValue
          }
        >
          {r.buildable} 台
        </span>
      ),
    },
    {
      key: 'bottleneck',
      header: 'ボトルネック部品',
      render: (r) => `${r.bottleneck_part_code}: ${r.bottleneck_part_name}`,
    },
    {
      key: 'stock',
      header: '在庫 / 必要数',
      width: '120px',
      render: (r) => `${r.bottleneck_stock} / ${r.bottleneck_required}`,
    },
  ]
  return (
    <Section title="在庫からの組立可能数（必須BOM基準）">
      <DataTable
        columns={columns}
        rows={summary.stock_coverage}
        rowKey={(r) => r.product_model_id}
        onRowClick={(r) => navigate(`/workspace/product-models/${r.product_model_id}`)}
        emptyText="BOM定義のある製品モデルがありません"
      />
    </Section>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: summary, isPending } = useGet<DashboardSummary>(
    '/dashboard/summary/',
    { refetchInterval: 60_000 },
  )
  const maintenance = useList<MaintenanceEvent>('/maintenance-events/', {
    page_size: 10,
  })
  const deploys = useList<DeployEvent>('/deploy-events/', { page_size: 10 })

  const recentEvents: RecentEvent[] = [
    ...(maintenance.data?.results ?? []).map((e) => ({
      key: `m-${e.id}`,
      occurred_at: e.occurred_at ?? '',
      kind: '保守' as const,
      set_id: e.bss_set,
      set_code: e.set_code,
      label: e.event_type_display + (e.serial_number ? `: ${e.serial_number}` : ''),
      note: e.note ?? null,
    })),
    ...(deploys.data?.results ?? []).map((e) => ({
      key: `d-${e.id}`,
      occurred_at: e.occurred_at ?? '',
      kind: '導入' as const,
      set_id: e.bss_set,
      set_code: e.set_code,
      label: e.stage_display,
      note: e.note ?? null,
    })),
  ]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 10)

  const kpis = [
    { label: 'セット総数', value: summary?.sets.total, to: '/workspace/sets' },
    {
      label: '稼働中セット',
      value: summary?.sets.by_status?.INSTALLED ?? 0,
      to: '/workspace/sets?status=INSTALLED',
    },
    {
      label: '部品実物総数',
      value: summary?.part_units.total,
      to: '/workspace/part-units',
    },
    {
      label: '在庫部品',
      value: summary?.part_units.by_status?.IN_STOCK ?? 0,
      to: '/workspace/part-units?status=IN_STOCK',
    },
  ]

  return (
    <div>
      <PageHeader
        title="ダッシュボード"
        description="セット・部品・拠点のサマリー（60秒ごとに自動更新 / カードとグラフから一覧へドリルダウン）"
      />

      {isPending && <p>読み込み中...</p>}

      {summary && (
        <>
          <div className={styles.kpiGrid}>
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>

          <AttentionPanel summary={summary} />

          <div className={styles.chartGrid}>
            <Section title={`セット状態（全${summary.sets.total}台）`}>
              <div className={styles.chartCard}>
                <StatusChart
                  data={toChartData(summary.sets.by_status, setStatusLabels)}
                  onBarClick={(key) => navigate(`/workspace/sets?status=${key}`)}
                />
              </div>
            </Section>
            <Section title={`部品状態（全${summary.part_units.total}点）`}>
              <div className={styles.chartCard}>
                <StatusChart
                  data={toChartData(summary.part_units.by_status, unitStatusLabels)}
                  onBarClick={(key) =>
                    navigate(`/workspace/part-units?status=${key}`)
                  }
                />
              </div>
            </Section>
            <Section title={`拠点状況（全${summary.sites.total}拠点 / 顧客${summary.customers.total}社）`}>
              <div className={styles.chartCard}>
                <StatusChart
                  data={toChartData(
                    summary.sites.by_lifecycle_status,
                    lifecycleLabels,
                  )}
                  onBarClick={(key) =>
                    navigate(
                      `/workspace/customers?tab=sites&lifecycle_status=${key}`,
                    )
                  }
                />
              </div>
            </Section>
            <Section title="部品カテゴリ内訳">
              <div className={styles.chartCard}>
                <StatusChart
                  data={toChartData(summary.part_units.by_category)}
                  onBarClick={(key) =>
                    navigate(
                      `/workspace/part-units?category=${encodeURIComponent(key)}`,
                    )
                  }
                />
              </div>
            </Section>
          </div>

          <StockCoverageTable summary={summary} />
        </>
      )}

      <Section title="直近の動き（保守・導入イベント）">
        <DataTable
          columns={recentColumns}
          rows={recentEvents}
          rowKey={(r) => r.key}
          loading={maintenance.isPending || deploys.isPending}
          emptyText="イベントはありません"
        />
      </Section>
    </div>
  )
}
