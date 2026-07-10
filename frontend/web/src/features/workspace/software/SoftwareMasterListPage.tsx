/**
 * ソフトウェアマスタ一覧（部品マスタのソフト版・Phase 1）
 *
 * 1台に載るソフト一式（アプリスタック）を粗い粒度で管理。行の「バージョン」から
 * そのソフトのバージョン一覧へ遷移する。
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useList } from '../../../api/hooks'
import type { SoftwareMaster } from '../../../api/types'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '../../../components/FilterBar'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { useListParams } from '../../../hooks/useListParams'
import { useNewParam } from '../../../hooks/useNewParam'
import { useSearchFilter } from '../shared/useSearchFilter'
import { SoftwareMasterFormDrawer } from './SoftwareMasterFormDrawer'

const kindOptions = [
  { value: 'STACK', label: 'アプリスタック' },
  { value: 'FIRMWARE', label: 'ファームウェア' },
  { value: 'OS', label: 'OS' },
  { value: 'OTHER', label: 'その他' },
]

export function SoftwareMasterListPage() {
  const navigate = useNavigate()
  const { params, page, setPage, setFilter, getFilter } = useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const { data, isPending } = useList<SoftwareMaster>('/software-masters/', params)
  const [editing, setEditing] = useState<SoftwareMaster | 'new' | null>(null)
  useNewParam(() => setEditing('new'))

  const columns: Column<SoftwareMaster>[] = [
    { key: 'code', header: 'コード', render: (r) => r.code },
    { key: 'name', header: 'ソフトウェア名', render: (r) => r.name },
    { key: 'kind', header: '種別', render: (r) => r.kind_display },
    { key: 'vendor', header: '提供元', render: (r) => r.vendor ?? '-' },
    {
      key: 'version_count',
      header: 'バージョン数',
      width: '100px',
      render: (r) => r.version_count,
    },
    {
      key: 'is_active',
      header: '有効',
      render: (r) =>
        r.is_active ? <Badge variant="sky">有効</Badge> : <Badge variant="gray">無効</Badge>,
    },
    {
      key: 'versions',
      header: 'バージョン',
      width: '110px',
      render: (r) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/workspace/software-versions?software=${r.id}`)
          }}
        >
          一覧
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ソフトウェアマスタ"
        description="装置に載るソフト一式・ファームウェアを管理します（行クリックで編集）"
        actions={<Button onClick={() => setEditing('new')}>新規作成</Button>}
      />

      <FilterBar>
        <SearchInput
          value={text}
          onChange={setText}
          placeholder="コード・名称・提供元で検索"
        />
        <SelectFilter
          value={getFilter('kind')}
          onChange={(v) => setFilter('kind', v)}
          options={kindOptions}
          allLabel="全種別"
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
        <SoftwareMasterFormDrawer
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
