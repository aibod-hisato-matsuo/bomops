/**
 * BSSセット一覧（W-7）
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useList } from '../../../api/hooks'
import type { BssSet } from '../../../api/types'
import { Badge } from '../../../components/Badge'
import { bssSetStatusVariant } from '../../../components/badge-variants'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '../../../components/FilterBar'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { useListParams } from '../../../hooks/useListParams'
import { useSearchFilter } from '../shared/useSearchFilter'
import { BssSetFormDrawer } from './BssSetFormDrawer'

const statusOptions = [
  { value: 'ASSEMBLED', label: '組立完了' },
  { value: 'INSTALLED', label: '設置済' },
  { value: 'REPAIR', label: '修理中' },
  { value: 'RECOVERED', label: '回収済' },
  { value: 'SCRAPPED', label: '廃棄' },
]

const columns: Column<BssSet>[] = [
  { key: 'set_code', header: 'セットコード', render: (r) => r.set_code },
  { key: 'product_model_code', header: '製品モデル', render: (r) => r.product_model_code },
  {
    key: 'status',
    header: 'ステータス',
    render: (r) => (
      <Badge variant={bssSetStatusVariant[r.status ?? ''] ?? 'pale'}>
        {r.status_display}
      </Badge>
    ),
  },
  { key: 'customer_name', header: '顧客', render: (r) => r.customer_name ?? '-' },
  { key: 'customer_site_name', header: '設置拠点', render: (r) => r.customer_site_name ?? '-' },
  {
    key: 'installed_at',
    header: '設置日時',
    render: (r) => (r.installed_at ? r.installed_at.slice(0, 10) : '-'),
  },
  { key: 'components_count', header: '構成部品数', render: (r) => r.components_count },
]

export function BssSetListPage() {
  const navigate = useNavigate()
  const { params, page, setPage, setFilter, getFilter } = useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const { data, isPending } = useList<BssSet>('/bss-sets/', params)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHeader
        title="BSSセット"
        description="完成機1台ごとの構成・設置先を管理します（行クリックで詳細）"
        actions={<Button onClick={() => setCreating(true)}>新規作成</Button>}
      />

      <FilterBar>
        <SearchInput
          value={text}
          onChange={setText}
          placeholder="セットコードで検索"
        />
        <SelectFilter
          value={getFilter('status')}
          onChange={(v) => setFilter('status', v)}
          options={statusOptions}
          allLabel="全ステータス"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={data?.results}
        rowKey={(r) => r.id}
        loading={isPending}
        onRowClick={(r) => navigate(`/workspace/sets/${r.id}`)}
      />
      <Pagination count={data?.count} page={page} onPageChange={setPage} />

      {creating && <BssSetFormDrawer item={null} onClose={() => setCreating(false)} />}
    </div>
  )
}
