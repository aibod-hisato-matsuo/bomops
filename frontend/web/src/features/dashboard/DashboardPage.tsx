/**
 * Dashboard（P5）
 *
 * サマリーAPIのKPIカード・状態別チャートと直近イベントを表示する。
 * 60秒間隔で自動更新。
 */

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

const categoryLabels: Record<string, string> = {
  PC: 'PC',
  MONITOR: 'モニター',
  CAMERA: 'カメラ',
  BARCODE: 'バーコード',
  PAYMENT: '決済端末',
  CABLE: 'ケーブル',
  OTHER: 'その他',
}

function toChartData(
  counts: Record<string, number> | undefined,
  labels: Record<string, string>,
): { name: string; count: number }[] {
  return Object.keys(labels)
    .filter((key) => (counts?.[key] ?? 0) > 0)
    .map((key) => ({ name: labels[key], count: counts?.[key] ?? 0 }))
}

function StatusChart({
  data,
}: {
  data: { name: string; count: number }[]
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
        <Bar dataKey="count" name="件数" fill={AIBOD_SKY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface RecentEvent {
  key: string
  occurred_at: string
  kind: '保守' | '導入'
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
  { key: 'set_code', header: 'セット', render: (r) => r.set_code },
  { key: 'label', header: '内容', render: (r) => r.label },
  { key: 'note', header: '備考', render: (r) => r.note ?? '-' },
]

export function DashboardPage() {
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
      set_code: e.set_code,
      label: e.event_type_display + (e.serial_number ? `: ${e.serial_number}` : ''),
      note: e.note ?? null,
    })),
    ...(deploys.data?.results ?? []).map((e) => ({
      key: `d-${e.id}`,
      occurred_at: e.occurred_at ?? '',
      kind: '導入' as const,
      set_code: e.set_code,
      label: e.stage_display,
      note: e.note ?? null,
    })),
  ]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 10)

  const kpis = [
    { label: 'セット総数', value: summary?.sets.total },
    { label: '稼働中セット', value: summary?.sets.by_status?.INSTALLED ?? 0 },
    { label: '部品実物総数', value: summary?.part_units.total },
    { label: '在庫部品', value: summary?.part_units.by_status?.IN_STOCK ?? 0 },
  ]

  return (
    <div>
      <PageHeader
        title="ダッシュボード"
        description="セット・部品・拠点のサマリー（60秒ごとに自動更新）"
      />

      {isPending && <p>読み込み中...</p>}

      {summary && (
        <>
          <div className={styles.kpiGrid}>
            {kpis.map((kpi) => (
              <div key={kpi.label} className={styles.kpiCard}>
                <span className={styles.kpiLabel}>{kpi.label}</span>
                <span className={styles.kpiValue}>{kpi.value ?? '-'}</span>
              </div>
            ))}
          </div>

          <div className={styles.chartGrid}>
            <Section title={`セット状態（全${summary.sets.total}台）`}>
              <div className={styles.chartCard}>
                <StatusChart
                  data={toChartData(summary.sets.by_status, setStatusLabels)}
                />
              </div>
            </Section>
            <Section title={`部品状態（全${summary.part_units.total}点）`}>
              <div className={styles.chartCard}>
                <StatusChart
                  data={toChartData(summary.part_units.by_status, unitStatusLabels)}
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
                />
              </div>
            </Section>
            <Section title="部品カテゴリ内訳">
              <div className={styles.chartCard}>
                <StatusChart
                  data={toChartData(summary.part_units.by_category, categoryLabels)}
                />
              </div>
            </Section>
          </div>
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
