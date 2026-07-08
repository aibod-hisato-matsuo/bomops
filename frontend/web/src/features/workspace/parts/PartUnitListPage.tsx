/**
 * 部品実物（W-3）— 製品 → 部品コード → 実物一覧 のドリルダウン
 *
 * 実物は件数が多いため、いきなり全件を並べず段階的に絞り込む:
 *   1. 製品（ファミリ）ピルで絞り込み
 *   2. 部品コード（部品マスタ）一覧から対象を選ぶ（実物カウント付き）
 *   3. ?part_master=<id> で「その部品コードの実物一覧」フレームへ切替
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useDetail, useGet, useList } from '../../../api/hooks'
import type {
  PartMaster,
  PartMasterProductSummary,
  PartUnit,
} from '../../../api/types'
import { Badge } from '../../../components/Badge'
import { partUnitStatusVariant } from '../../../components/badge-variants'
import { Button } from '../../../components/Button'
import { CascadeRow } from '../../../components/CascadeRow'
import { DataTable, type Column } from '../../../components/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '../../../components/FilterBar'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { useListParams } from '../../../hooks/useListParams'
import { PartUnitFormDrawer } from './PartUnitFormDrawer'

const statusOptions = [
  { value: 'IN_STOCK', label: '在庫' },
  { value: 'ASSIGNED', label: '割当済' },
  { value: 'BROKEN', label: '故障' },
  { value: 'SCRAPPED', label: '廃棄' },
]

export function PartUnitListPage() {
  const navigate = useNavigate()
  const { page, setPage, setFilter, setFilters, getFilter } = useListParams()

  const activeFamily = getFilter('used_in_family')
  const activePartMaster = getFilter('part_master')
  const mode = activePartMaster ? 'units' : 'browse'

  const [editing, setEditing] = useState<PartUnit | 'new' | null>(null)
  // 部品コード一覧のクライアント側検索（≤200件なので絞り込みは手元で）
  const [codeQuery, setCodeQuery] = useState('')
  // 実物一覧のシリアル検索
  const serial = getFilter('serial')

  // ---- 製品ピル（部品コード数／ファミリ）----
  const productSummary = useGet<PartMasterProductSummary[]>(
    '/part-masters/product-summary/',
  )
  const productOptions = (productSummary.data ?? []).map((r) => ({
    value: r.family,
    label: r.family,
    count: r.count,
  }))
  const totalPartMasters = useList<PartMaster>('/part-masters/', { page_size: 1 })

  // ---- 部品コード一覧（browse モード）----
  const partMasters = useList<PartMaster>('/part-masters/', {
    used_in_family: activeFamily || undefined,
    page_size: 200,
  })
  const filteredMasters = (partMasters.data?.results ?? []).filter((m) => {
    if (codeQuery.trim() === '') return true
    const q = codeQuery.toLowerCase()
    return (
      m.part_code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    )
  })

  // ---- 実物一覧（units モード）----
  const selectedMaster = useDetail<PartMaster>(
    '/part-masters/',
    mode === 'units' ? activePartMaster : undefined,
  )
  const units = useList<PartUnit>(
    '/part-units/',
    mode === 'units'
      ? {
          part_master: activePartMaster,
          status: getFilter('status') || undefined,
          serial_number: serial || undefined,
          page: page > 1 ? page : undefined,
        }
      : {},
  )

  const masterColumns: Column<PartMaster>[] = [
    { key: 'part_code', header: '部品コード', render: (r) => r.part_code },
    { key: 'name', header: '部品名', render: (r) => r.name },
    { key: 'category', header: 'カテゴリ', render: (r) => r.category_display },
    {
      key: 'unit_count',
      header: '実物',
      width: '70px',
      render: (r) => r.unit_count,
    },
    {
      key: 'in_stock_count',
      header: '在庫',
      width: '70px',
      render: (r) => (
        <span style={{ fontWeight: 700, color: 'var(--aibod-sky)' }}>
          {r.in_stock_count}
        </span>
      ),
    },
    {
      key: 'broken_count',
      header: '故障',
      width: '70px',
      render: (r) =>
        r.broken_count > 0 ? (
          <span style={{ color: 'var(--color-danger)' }}>{r.broken_count}</span>
        ) : (
          '0'
        ),
    },
  ]

  const unitColumns: Column<PartUnit>[] = [
    { key: 'serial_number', header: 'シリアル番号', render: (r) => r.serial_number },
    {
      key: 'status',
      header: 'ステータス',
      render: (r) => (
        <Badge variant={partUnitStatusVariant[r.status ?? ''] ?? 'pale'}>
          {r.status_display}
        </Badge>
      ),
    },
    {
      key: 'current_set',
      header: '使用中セット',
      render: (r) =>
        r.current_set ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/workspace/sets/${r.current_set!.set_id}`)
            }}
            title={
              `${r.current_set.customer_name ?? ''} ${r.current_set.site_name ?? ''}`.trim() ||
              undefined
            }
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: 'var(--aibod-blue)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {r.current_set.set_code}
            {r.current_set.role ? `（${r.current_set.role}）` : ''}
          </button>
        ) : (
          <span style={{ color: 'var(--color-text-sub)' }}>未搭載</span>
        ),
    },
    { key: 'purchase_date', header: '購入日', render: (r) => r.purchase_date ?? '-' },
    {
      key: 'purchase_order_no',
      header: '発注番号',
      render: (r) => r.purchase_order_no ?? '-',
    },
    {
      key: 'history',
      header: '使用履歴',
      width: '90px',
      render: (r) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/workspace/part-units/${r.id}/history`)
          }}
        >
          履歴
        </Button>
      ),
    },
  ]

  // ===== 実物一覧フレーム（units モード） =====
  if (mode === 'units') {
    const m = selectedMaster.data
    return (
      <div>
        <PageHeader
          title={m ? `実物一覧: ${m.part_code}` : '実物一覧'}
          description={m ? `${m.name}（${m.category_display}）` : undefined}
          actions={
            <>
              <Button onClick={() => setEditing('new')}>新規作成</Button>
              <Button
                variant="secondary"
                onClick={() => setFilters({ part_master: '', status: '', serial: '' })}
              >
                ← 部品コード一覧へ戻る
              </Button>
            </>
          }
        />

        <FilterBar>
          <SearchInput
            value={serial}
            onChange={(v) => setFilter('serial', v)}
            placeholder="シリアル番号で検索"
          />
          <SelectFilter
            value={getFilter('status')}
            onChange={(v) => setFilter('status', v)}
            options={statusOptions}
            allLabel="全ステータス"
          />
        </FilterBar>

        <DataTable
          columns={unitColumns}
          rows={units.data?.results}
          rowKey={(r) => r.id}
          loading={units.isPending}
          onRowClick={(r) => setEditing(r)}
          emptyText="この部品コードの実物はありません"
        />
        <Pagination count={units.data?.count} page={page} onPageChange={setPage} />

        {editing && (
          <PartUnitFormDrawer
            item={editing === 'new' ? null : editing}
            defaultPartMasterId={
              editing === 'new' ? Number(activePartMaster) : undefined
            }
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    )
  }

  // ===== 部品コード一覧フレーム（browse モード） =====
  return (
    <div>
      <PageHeader
        title="部品実物"
        description="製品 → 部品コードの順に選ぶと、その部品の実物一覧に移動します"
      />

      {productOptions.length > 0 && (
        <CascadeRow
          label="製品:"
          options={productOptions}
          active={activeFamily}
          allCount={totalPartMasters.data?.count}
          onChange={(v) => setFilter('used_in_family', v)}
        />
      )}

      <FilterBar>
        <SearchInput
          value={codeQuery}
          onChange={setCodeQuery}
          placeholder="部品コード・部品名で絞り込み"
        />
      </FilterBar>

      <DataTable
        columns={masterColumns}
        rows={filteredMasters}
        rowKey={(r) => r.id}
        loading={partMasters.isPending}
        onRowClick={(r) => setFilter('part_master', String(r.id))}
        emptyText="該当する部品コードがありません"
      />
    </div>
  )
}
