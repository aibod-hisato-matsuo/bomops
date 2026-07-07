/**
 * 製品セット一覧（W-7）
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useGet, useList } from '../../../api/hooks'
import type { BssSet, BssSetLocationSummary } from '../../../api/types'
import { Badge } from '../../../components/Badge'
import { bssSetStatusVariant } from '../../../components/badge-variants'
import { Button } from '../../../components/Button'
import { CascadeRow } from '../../../components/CascadeRow'
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
  { key: 'site_country', header: '国', render: (r) => r.site_country ?? '-' },
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
  const { params, page, setPage, setFilter, setFilters, getFilter } =
    useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const { data, isPending } = useList<BssSet>('/bss-sets/', params)
  const [creating, setCreating] = useState(false)

  // 納品先（国×顧客×拠点）の件数集計
  const summary = useGet<BssSetLocationSummary[]>('/bss-sets/location-summary/')
  const summaryRows = summary.data ?? []

  const activeCountry = getFilter('country')
  const activeCustomer = getFilter('customer')
  const activeSite = getFilter('customer_site')

  const countryOptions = (() => {
    const counts = new Map<string, number>()
    for (const row of summaryRows) {
      if (row.country === null) continue
      counts.set(row.country, (counts.get(row.country) ?? 0) + row.count)
    }
    return Array.from(counts, ([value, count]) => ({
      value,
      label: value,
      count,
    })).sort((a, b) => b.count - a.count)
  })()

  const countryRows = summaryRows.filter((r) => r.country === activeCountry)
  const customerOptions = (() => {
    const seen = new Map<string, { label: string; count: number }>()
    for (const row of countryRows) {
      if (row.customer === null) continue
      const key = String(row.customer)
      const prev = seen.get(key)
      seen.set(key, {
        label: row.customer_name ?? key,
        count: (prev?.count ?? 0) + row.count,
      })
    }
    return Array.from(seen, ([value, v]) => ({ value, ...v })).sort(
      (a, b) => b.count - a.count,
    )
  })()

  const customerRows = countryRows.filter(
    (r) => String(r.customer) === activeCustomer,
  )
  const siteOptions = customerRows
    .filter((r) => r.site !== null)
    .map((r) => ({
      value: String(r.site),
      label: r.site_name ?? String(r.site),
      count: r.count,
    }))

  const totalCount =
    summary.data === undefined
      ? undefined
      : summaryRows.reduce((a, r) => a + r.count, 0)
  const countryTotal = countryRows.reduce((a, r) => a + r.count, 0)
  const customerTotal = customerRows.reduce((a, r) => a + r.count, 0)

  return (
    <div>
      <PageHeader
        title="製品セット"
        description="完成機1台ごとの構成・設置先を管理します（行クリックで詳細）"
        actions={<Button onClick={() => setCreating(true)}>新規作成</Button>}
      />

      <CascadeRow
        label="国:"
        options={countryOptions}
        active={activeCountry}
        allCount={totalCount}
        onChange={(v) =>
          setFilters({ country: v, customer: '', customer_site: '' })
        }
      />

      {activeCountry !== '' && customerOptions.length > 0 && (
        <CascadeRow
          label="顧客:"
          options={customerOptions}
          active={activeCustomer}
          allCount={countryTotal}
          onChange={(v) => setFilters({ customer: v, customer_site: '' })}
        />
      )}

      {activeCustomer !== '' && siteOptions.length > 0 && (
        <CascadeRow
          label="拠点:"
          options={siteOptions}
          active={activeSite}
          allCount={customerTotal}
          onChange={(v) => setFilter('customer_site', v)}
        />
      )}

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
