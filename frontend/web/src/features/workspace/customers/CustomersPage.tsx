/**
 * 顧客・拠点（W-5）— タブで顧客一覧と拠点一覧を切り替え
 *
 * 行クリックで編集。拠点行の「設定」から拠点設定（SiteConfig）へ遷移する。
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useGet, useList } from '../../../api/hooks'
import type {
  Customer,
  CustomerProductSummary,
  CustomerSite,
} from '../../../api/types'
import { Badge } from '../../../components/Badge'
import { lifecycleStatusVariant } from '../../../components/badge-variants'
import { Button } from '../../../components/Button'
import { CascadeRow } from '../../../components/CascadeRow'
import { DataTable, type Column } from '../../../components/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '../../../components/FilterBar'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { Tabs } from '../../../components/Tabs'
import { useListParams } from '../../../hooks/useListParams'
import { useSearchFilter } from '../shared/useSearchFilter'
import { CustomerFormDrawer } from './CustomerFormDrawer'
import { SiteFormDrawer } from './SiteFormDrawer'

const customerColumns: Column<Customer>[] = [
  { key: 'code', header: '顧客コード', render: (r) => r.code },
  { key: 'name', header: '顧客名', render: (r) => r.name },
  {
    key: 'products',
    header: '取扱製品',
    render: (r) =>
      r.products.length === 0 ? (
        '-'
      ) : (
        <>
          {r.products.map((p) => (
            <span key={p.name} title={p.installed ? '設置実績あり' : '手動登録（実績なし）'}>
              <Badge variant={p.installed ? 'sky' : 'pale'}>{p.name}</Badge>{' '}
            </span>
          ))}
        </>
      ),
  },
  { key: 'contact_person', header: '担当者', render: (r) => r.contact_person ?? '-' },
  { key: 'contact_email', header: 'メール', render: (r) => r.contact_email ?? '-' },
  { key: 'sites_count', header: '拠点数', render: (r) => r.sites_count },
]

const lifecycleOptions = [
  { value: 'PREPARING', label: '準備中' },
  { value: 'ACTIVE', label: '稼働中' },
  { value: 'WITHDRAWN', label: '撤退済' },
  { value: 'BASE', label: '拠点' },
  { value: 'LOANED', label: '貸出中' },
]

export function CustomersPage() {
  const navigate = useNavigate()
  const { params, page, setPage, setFilter, getFilter } = useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const tab = getFilter('tab') || 'customers'

  const customers = useList<Customer>('/customers/', tab === 'customers' ? params : {})
  const sites = useList<CustomerSite>('/customer-sites/', tab === 'sites' ? params : {})
  const active = tab === 'customers' ? customers : sites

  const [editingCustomer, setEditingCustomer] = useState<Customer | 'new' | null>(null)
  const [editingSite, setEditingSite] = useState<CustomerSite | 'new' | null>(null)

  // 製品ファミリ別の集計（設置実績からの導出）。顧客タブ・拠点タブで別集計
  const customerProductSummary = useGet<CustomerProductSummary[]>(
    '/customers/product-summary/',
  )
  const siteProductSummary = useGet<CustomerProductSummary[]>(
    '/customer-sites/product-summary/',
  )
  const customerTotal = useList<Customer>('/customers/', { page_size: 1 })
  const siteTotal = useList<CustomerSite>('/customer-sites/', { page_size: 1 })

  const toOptions = (rows: CustomerProductSummary[] | undefined) =>
    (rows ?? []).map((r) => ({ value: r.family, label: r.family, count: r.count }))

  const productOptions =
    tab === 'customers'
      ? toOptions(customerProductSummary.data)
      : toOptions(siteProductSummary.data)
  const productTotalCount =
    tab === 'customers' ? customerTotal.data?.count : siteTotal.data?.count

  const siteColumns: Column<CustomerSite>[] = [
    { key: 'name', header: '拠点名', render: (r) => r.name },
    { key: 'customer_name', header: '顧客', render: (r) => r.customer_name },
    {
      key: 'products',
      header: '設置製品',
      render: (r) =>
        r.products.length === 0 ? (
          '-'
        ) : (
          <>
            {r.products.map((name) => (
              <span key={name}>
                <Badge variant="sky">{name}</Badge>{' '}
              </span>
            ))}
          </>
        ),
    },
    {
      key: 'lifecycle_status',
      header: '状態',
      render: (r) => (
        <Badge variant={lifecycleStatusVariant[r.lifecycle_status ?? ''] ?? 'pale'}>
          {r.lifecycle_status_display}
        </Badge>
      ),
    },
    { key: 'address', header: '住所', render: (r) => r.address ?? '-' },
    {
      key: 'config',
      header: '拠点設定',
      width: '90px',
      render: (r) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/workspace/sites/${r.id}/config`)
          }}
        >
          設定
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="顧客・拠点"
        description="設置先の顧客と拠点を管理します（行クリックで編集）"
        actions={
          tab === 'customers' ? (
            <Button onClick={() => setEditingCustomer('new')}>顧客を作成</Button>
          ) : (
            <Button onClick={() => setEditingSite('new')}>拠点を作成</Button>
          )
        }
      />

      <Tabs
        tabs={[
          { key: 'customers', label: '顧客' },
          { key: 'sites', label: '拠点' },
        ]}
        active={tab}
        onChange={(key) => setFilter('tab', key)}
      />

      {productOptions.length > 0 && (
        <CascadeRow
          label="製品:"
          options={productOptions}
          active={getFilter('product_family')}
          allCount={productTotalCount}
          onChange={(v) => setFilter('product_family', v)}
        />
      )}

      <FilterBar>
        <SearchInput
          value={text}
          onChange={setText}
          placeholder={tab === 'customers' ? '顧客名・コードで検索' : '拠点名・住所で検索'}
        />
        {tab === 'sites' && (
          <SelectFilter
            value={getFilter('lifecycle_status')}
            onChange={(v) => setFilter('lifecycle_status', v)}
            options={lifecycleOptions}
            allLabel="全状態"
          />
        )}
      </FilterBar>

      {tab === 'customers' ? (
        <DataTable
          columns={customerColumns}
          rows={customers.data?.results}
          rowKey={(r) => r.id}
          loading={customers.isPending}
          onRowClick={(r) => setEditingCustomer(r)}
        />
      ) : (
        <DataTable
          columns={siteColumns}
          rows={sites.data?.results}
          rowKey={(r) => r.id}
          loading={sites.isPending}
          onRowClick={(r) => setEditingSite(r)}
        />
      )}
      <Pagination count={active.data?.count} page={page} onPageChange={setPage} />

      {editingCustomer && (
        <CustomerFormDrawer
          item={editingCustomer === 'new' ? null : editingCustomer}
          onClose={() => setEditingCustomer(null)}
        />
      )}
      {editingSite && (
        <SiteFormDrawer
          item={editingSite === 'new' ? null : editingSite}
          onClose={() => setEditingSite(null)}
        />
      )}
    </div>
  )
}
