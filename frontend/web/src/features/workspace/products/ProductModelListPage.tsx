/**
 * 製品モデル一覧（W-4）
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useList } from '../../../api/hooks'
import type { ProductModel } from '../../../api/types'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { FilterBar, SearchInput } from '../../../components/FilterBar'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { useListParams } from '../../../hooks/useListParams'
import { useSearchFilter } from '../shared/useSearchFilter'
import { ProductModelFormDrawer } from './ProductModelFormDrawer'

const columns: Column<ProductModel>[] = [
  { key: 'code', header: '製品コード', render: (r) => r.code },
  { key: 'name', header: '製品名', render: (r) => r.name },
  { key: 'description', header: '説明', render: (r) => r.description ?? '-' },
]

export function ProductModelListPage() {
  const navigate = useNavigate()
  const { params, page, setPage, setFilter, getFilter } = useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const { data, isPending } = useList<ProductModel>('/product-models/', params)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHeader
        title="製品モデル"
        description="製品型番とBOM構成表を管理します（行クリックでBOM表示）"
        actions={<Button onClick={() => setCreating(true)}>新規作成</Button>}
      />

      <FilterBar>
        <SearchInput
          value={text}
          onChange={setText}
          placeholder="製品コード・製品名で検索"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={data?.results}
        rowKey={(r) => r.id}
        loading={isPending}
        onRowClick={(r) => navigate(`/workspace/product-models/${r.id}`)}
      />
      <Pagination count={data?.count} page={page} onPageChange={setPage} />

      {creating && (
        <ProductModelFormDrawer item={null} onClose={() => setCreating(false)} />
      )}
    </div>
  )
}
