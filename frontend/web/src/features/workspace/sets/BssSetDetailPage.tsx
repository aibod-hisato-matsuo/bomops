/**
 * 製品セット詳細（W-7 / W-8）
 *
 * 基本情報・搭載部品（搭載/取外し）・コンフィグ・イベント履歴（追記）を扱う。
 * イベントは追記型のため編集・削除UIを置かない。
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { parseApiErrors } from '../../../api/errors'
import { useDetail, useGet, useList, useUpdate } from '../../../api/hooks'
import type {
  BssSet,
  BssSetComponent,
  DeployEvent,
  EffectiveConfig,
  MaintenanceEvent,
  PartUnit,
} from '../../../api/types'
import { Badge } from '../../../components/Badge'
import { bssSetStatusVariant } from '../../../components/badge-variants'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { DescList, Section } from '../../../components/DescList'
import { PageHeader } from '../../../components/PageHeader'
import { useToast } from '../../../components/toast/toast-context'
import { BssSetFormDrawer } from './BssSetFormDrawer'
import { EventFormDrawer } from './EventFormDrawer'
import { MountComponentDrawer } from './MountComponentDrawer'
import { SetConfigFormDrawer } from './SetConfigFormDrawer'

const configColumns: Column<EffectiveConfig>[] = [
  { key: 'config_group', header: 'グループ', render: (r) => r.config_group },
  { key: 'key', header: 'キー', render: (r) => r.key },
  { key: 'value', header: '値', render: (r) => r.value ?? '-' },
  {
    key: 'is_secret',
    header: '秘匿',
    render: (r) => (r.is_secret ? <Badge variant="navy">秘匿</Badge> : '-'),
  },
]

const maintenanceColumns: Column<MaintenanceEvent>[] = [
  {
    key: 'occurred_at',
    header: '発生日時',
    render: (r) => r.occurred_at?.slice(0, 16).replace('T', ' ') ?? '-',
  },
  { key: 'event_type', header: '種別', render: (r) => r.event_type_display },
  { key: 'serial_number', header: '対象部品', render: (r) => r.serial_number ?? '-' },
  { key: 'note', header: '備考', render: (r) => r.note ?? '-' },
]

const deployColumns: Column<DeployEvent>[] = [
  {
    key: 'occurred_at',
    header: '発生日時',
    render: (r) => r.occurred_at?.slice(0, 16).replace('T', ' ') ?? '-',
  },
  { key: 'stage', header: 'ステージ', render: (r) => r.stage_display },
  { key: 'note', header: '備考', render: (r) => r.note ?? '-' },
]

type DrawerState =
  | { kind: 'edit' }
  | { kind: 'mount' }
  | { kind: 'maintenance' }
  | { kind: 'deploy' }
  | { kind: 'config' }
  | null

export function BssSetDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data: set, isPending } = useDetail<BssSet>('/bss-sets/', id)
  const components = useList<BssSetComponent>('/bss-set-components/', { bss_set: id })
  const configs = useGet<EffectiveConfig[]>(
    id ? `/bss-sets/${id}/effective-configs/` : null,
  )
  const maintenance = useList<MaintenanceEvent>('/maintenance-events/', { bss_set: id })
  const deploys = useList<DeployEvent>('/deploy-events/', { bss_set: id })

  const updateComponent = useUpdate<BssSetComponent>('/bss-set-components/')
  const updateUnit = useUpdate<PartUnit>('/part-units/')
  const [drawer, setDrawer] = useState<DrawerState>(null)

  const handleUnmount = async (component: BssSetComponent) => {
    if (!window.confirm(`「${component.serial_number}」を取り外しますか？`)) return
    try {
      await updateComponent.mutateAsync({
        id: component.id,
        payload: { unmounted_at: new Date().toISOString() },
      })
      await updateUnit.mutateAsync({
        id: component.part_unit,
        payload: { status: 'IN_STOCK' },
      })
      toast.success('部品を取り外しました')
    } catch (err) {
      const { message } = parseApiErrors(err)
      toast.error(message ?? '取り外しに失敗しました')
    }
  }

  const componentColumns: Column<BssSetComponent>[] = [
    { key: 'role', header: '役割', render: (r) => r.role ?? '-' },
    { key: 'part_code', header: '部品コード', render: (r) => r.part_code },
    { key: 'part_name', header: '部品名', render: (r) => r.part_name },
    { key: 'serial_number', header: 'シリアル番号', render: (r) => r.serial_number },
    {
      key: 'mounted',
      header: '搭載状態',
      render: (r) =>
        r.is_mounted ? (
          <Badge variant="sky">搭載中</Badge>
        ) : (
          <Badge variant="gray">取外し済</Badge>
        ),
    },
    {
      key: 'mounted_at',
      header: '搭載日時',
      render: (r) => (r.mounted_at ? r.mounted_at.slice(0, 10) : '-'),
    },
    {
      key: 'unmounted_at',
      header: '取外し日時',
      render: (r) => (r.unmounted_at ? r.unmounted_at.slice(0, 10) : '-'),
    },
    {
      key: 'actions',
      header: '操作',
      width: '90px',
      render: (r) =>
        r.is_mounted ? (
          <Button variant="danger" size="sm" onClick={() => handleUnmount(r)}>
            取外し
          </Button>
        ) : (
          '-'
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={set ? `製品セット: ${set.set_code}` : '製品セット'}
        description={set?.product_model_name}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDrawer({ kind: 'edit' })}>
              編集
            </Button>
            <Link to="/workspace/sets">一覧へ戻る</Link>
          </>
        }
      />

      {isPending && <p>読み込み中...</p>}

      {set && (
        <Section title="基本情報">
          <DescList
            items={[
              { label: 'セットコード', value: set.set_code },
              { label: '製品モデル', value: `${set.product_model_code}: ${set.product_model_name}` },
              {
                label: 'ステータス',
                value: (
                  <Badge variant={bssSetStatusVariant[set.status ?? ''] ?? 'pale'}>
                    {set.status_display}
                  </Badge>
                ),
              },
              { label: '顧客', value: set.customer_name },
              { label: '設置拠点', value: set.customer_site_name },
              { label: '設置日時', value: set.installed_at },
              { label: '撤去日時', value: set.removed_at },
              { label: '備考', value: set.note },
            ]}
          />
        </Section>
      )}

      <Section title="搭載部品">
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={() => setDrawer({ kind: 'mount' })}>
            部品を搭載
          </Button>
        </div>
        <DataTable
          columns={componentColumns}
          rows={components.data?.results}
          rowKey={(r) => r.id}
          loading={components.isPending}
          emptyText="構成部品が登録されていません"
        />
      </Section>

      <Section title="有効なコンフィグ">
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={() => setDrawer({ kind: 'config' })}>
            設定を追加
          </Button>
        </div>
        <DataTable
          columns={configColumns}
          rows={configs.data}
          rowKey={(r) => `${r.config_group}.${r.key}`}
          loading={configs.isPending}
          emptyText="設定がありません"
        />
      </Section>

      <Section title="保守イベント履歴（追記型）">
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={() => setDrawer({ kind: 'maintenance' })}>
            保守イベントを追記
          </Button>
        </div>
        <DataTable
          columns={maintenanceColumns}
          rows={maintenance.data?.results}
          rowKey={(r) => r.id}
          loading={maintenance.isPending}
          emptyText="保守イベントはありません"
        />
      </Section>

      <Section title="導入イベント履歴（追記型）">
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={() => setDrawer({ kind: 'deploy' })}>
            導入イベントを追記
          </Button>
        </div>
        <DataTable
          columns={deployColumns}
          rows={deploys.data?.results}
          rowKey={(r) => r.id}
          loading={deploys.isPending}
          emptyText="導入イベントはありません"
        />
      </Section>

      {drawer?.kind === 'edit' && set && (
        <BssSetFormDrawer item={set} onClose={() => setDrawer(null)} />
      )}
      {drawer?.kind === 'mount' && set && (
        <MountComponentDrawer bssSetId={set.id} onClose={() => setDrawer(null)} />
      )}
      {(drawer?.kind === 'maintenance' || drawer?.kind === 'deploy') && set && (
        <EventFormDrawer
          bssSetId={set.id}
          eventCategory={drawer.kind}
          onClose={() => setDrawer(null)}
        />
      )}
      {drawer?.kind === 'config' && set && (
        <SetConfigFormDrawer bssSetId={set.id} onClose={() => setDrawer(null)} />
      )}
    </div>
  )
}
