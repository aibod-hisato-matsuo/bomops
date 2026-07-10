/**
 * ソフトウェアバージョン（部品実物のソフト版・Phase 1）
 *
 * ソフトウェア → バージョン一覧 のドリルダウン。
 *   1. ソフトウェアマスタを選ぶ（バージョン数付き）
 *   2. ?software=<id> でそのソフトのバージョン一覧フレームへ切替
 */

import { useState } from 'react'

import { useDetail, useList } from '../../../api/hooks'
import type { SoftwareMaster, SoftwareVersion } from '../../../api/types'
import { Badge } from '../../../components/Badge'
import type { BadgeVariant } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '../../../components/FilterBar'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { useListParams } from '../../../hooks/useListParams'
import { SoftwareVersionFormDrawer } from './SoftwareVersionFormDrawer'

const statusOptions = [
  { value: 'RELEASED', label: 'リリース' },
  { value: 'BETA', label: 'ベータ' },
  { value: 'DEPRECATED', label: '非推奨' },
]

const statusVariant: Record<string, BadgeVariant> = {
  RELEASED: 'sky',
  BETA: 'pale',
  DEPRECATED: 'gray',
}

export function SoftwareVersionPage() {
  const { page, setPage, setFilter, setFilters, getFilter } = useListParams()
  const activeSoftware = getFilter('software')
  const mode = activeSoftware ? 'versions' : 'browse'
  const [editing, setEditing] = useState<SoftwareVersion | 'new' | null>(null)

  // 一覧（browse）: ソフトウェアマスタ
  const softwares = useList<SoftwareMaster>('/software-masters/', {
    page_size: 200,
  })
  // 選択中ソフトの詳細（versions フレームのヘッダ用）
  const selected = useDetail<SoftwareMaster>(
    '/software-masters/',
    mode === 'versions' ? activeSoftware : undefined,
  )
  // バージョン一覧（versions）
  const versions = useList<SoftwareVersion>(
    '/software-versions/',
    mode === 'versions'
      ? {
          software: activeSoftware,
          status: getFilter('status') || undefined,
          version: getFilter('vquery') || undefined,
          page: page > 1 ? page : undefined,
        }
      : {},
  )

  const softwareColumns: Column<SoftwareMaster>[] = [
    { key: 'code', header: 'コード', render: (r) => r.code },
    { key: 'name', header: 'ソフトウェア名', render: (r) => r.name },
    { key: 'kind', header: '種別', render: (r) => r.kind_display },
    {
      key: 'version_count',
      header: 'バージョン数',
      width: '110px',
      render: (r) => (
        <span style={{ fontWeight: 700, color: 'var(--aibod-sky)' }}>
          {r.version_count}
        </span>
      ),
    },
  ]

  const versionColumns: Column<SoftwareVersion>[] = [
    { key: 'version', header: 'バージョン', render: (r) => r.version },
    {
      key: 'status',
      header: '状態',
      render: (r) => (
        <Badge variant={statusVariant[r.status ?? ''] ?? 'pale'}>
          {r.status_display}
        </Badge>
      ),
    },
    { key: 'release_date', header: 'リリース日', render: (r) => r.release_date ?? '-' },
    {
      key: 'artifact_ref',
      header: 'アーティファクト',
      render: (r) => r.artifact_ref ?? '-',
    },
    { key: 'notes', header: 'ノート', render: (r) => r.notes ?? '-' },
  ]

  // ===== バージョン一覧フレーム =====
  if (mode === 'versions') {
    const s = selected.data
    return (
      <div>
        <PageHeader
          title={s ? `バージョン一覧: ${s.code}` : 'バージョン一覧'}
          description={s ? `${s.name}（${s.kind_display}）` : undefined}
          actions={
            <>
              <Button onClick={() => setEditing('new')}>バージョン追加</Button>
              <Button
                variant="secondary"
                onClick={() => setFilters({ software: '', status: '', vquery: '' })}
              >
                ← ソフト一覧へ戻る
              </Button>
            </>
          }
        />

        <FilterBar>
          <SearchInput
            value={getFilter('vquery')}
            onChange={(v) => setFilter('vquery', v)}
            placeholder="バージョンで検索"
          />
          <SelectFilter
            value={getFilter('status')}
            onChange={(v) => setFilter('status', v)}
            options={statusOptions}
            allLabel="全状態"
          />
        </FilterBar>

        <DataTable
          columns={versionColumns}
          rows={versions.data?.results}
          rowKey={(r) => r.id}
          loading={versions.isPending}
          onRowClick={(r) => setEditing(r)}
          emptyText="バージョンがありません"
        />
        <Pagination count={versions.data?.count} page={page} onPageChange={setPage} />

        {editing && (
          <SoftwareVersionFormDrawer
            softwareId={Number(activeSoftware)}
            item={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    )
  }

  // ===== ソフト一覧フレーム =====
  return (
    <div>
      <PageHeader
        title="ソフトウェアバージョン"
        description="ソフトウェアを選ぶと、そのバージョン一覧に移動します"
      />
      <DataTable
        columns={softwareColumns}
        rows={softwares.data?.results}
        rowKey={(r) => r.id}
        loading={softwares.isPending}
        onRowClick={(r) => setFilter('software', String(r.id))}
        emptyText="ソフトウェアがありません"
      />
    </div>
  )
}
