/**
 * 部品実物一覧（W-3）
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useList } from '../../../api/hooks'
import type { PartCategory, PartUnit } from '../../../api/types'
import { Badge } from '../../../components/Badge'
import { partUnitStatusVariant } from '../../../components/badge-variants'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '../../../components/FilterBar'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { useListParams } from '../../../hooks/useListParams'
import { useSearchFilter } from '../shared/useSearchFilter'
import { PartUnitFormDrawer } from './PartUnitFormDrawer'

const statusOptions = [
  { value: 'IN_STOCK', label: '在庫' },
  { value: 'ASSIGNED', label: '割当済' },
  { value: 'BROKEN', label: '故障' },
  { value: 'SCRAPPED', label: '廃棄' },
]

export function PartUnitListPage() {
  const navigate = useNavigate()
  const { params, page, setPage, setFilter, getFilter } = useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const { data, isPending } = useList<PartUnit>('/part-units/', params)
  const [editing, setEditing] = useState<PartUnit | 'new' | null>(null)

  const categories = useList<PartCategory>('/part-categories/', { page_size: 200 })
  const categoryOptions = (categories.data?.results ?? []).map((c) => ({
    value: c.name,
    label: c.name,
  }))

  const columns: Column<PartUnit>[] = [
    { key: 'serial_number', header: 'シリアル番号', render: (r) => r.serial_number },
    { key: 'part_master_code', header: '部品コード', render: (r) => r.part_master_code },
    { key: 'part_master_name', header: '部品名', render: (r) => r.part_master_name },
    {
      key: 'status',
      header: 'ステータス',
      render: (r) => (
        <Badge variant={partUnitStatusVariant[r.status ?? ''] ?? 'pale'}>
          {r.status_display}
        </Badge>
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

  return (
    <div>
      <PageHeader
        title="部品実物"
        description="シリアル番号付きの実物部品を管理します（行クリックで編集）"
        actions={<Button onClick={() => setEditing('new')}>新規作成</Button>}
      />

      <FilterBar>
        <SearchInput
          value={text}
          onChange={setText}
          placeholder="シリアル番号で検索"
        />
        <SelectFilter
          value={getFilter('status')}
          onChange={(v) => setFilter('status', v)}
          options={statusOptions}
          allLabel="全ステータス"
        />
        <SelectFilter
          value={getFilter('category')}
          onChange={(v) => setFilter('category', v)}
          options={categoryOptions}
          allLabel="全カテゴリ"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={data?.results}
        rowKey={(r) => r.id}
        loading={isPending}
        onRowClick={(r) => setEditing(r)}
      />
      <Pagination count={data?.count} page={page} onPageChange={setPage} />

      {editing && (
        <PartUnitFormDrawer
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
