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

import { useCreate, useDetail, useGet, useList } from '../../../api/hooks'
import type {
  CustomerSite,
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
import { Select } from '../../../components/form/Field'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { useToast } from '../../../components/toast/toast-context'
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
  const toast = useToast()
  const { page, setPage, setFilter, setFilters, getFilter } = useListParams()

  const activeFamily = getFilter('used_in_family')
  const activePartMaster = getFilter('part_master')
  const mode = activePartMaster ? 'units' : 'browse'

  const [editing, setEditing] = useState<PartUnit | 'new' | null>(null)
  // 部品コード一覧のクライアント側検索（≤200件なので絞り込みは手元で）
  const [codeQuery, setCodeQuery] = useState('')
  // 実物一覧のシリアル検索
  const serial = getFilter('serial')

  // ---- 倉庫フィルタ（在庫の所在）----
  // 倉庫＝lifecycle_status=BASE（拠点）。在庫列と実物一覧をこの倉庫で絞る。
  const warehouses = useList<CustomerSite>('/customer-sites/', {
    lifecycle_status: 'BASE',
    page_size: 200,
  })
  const warehouseOptions = (warehouses.data?.results ?? []).map((w) => ({
    value: String(w.id),
    label: w.name,
  }))
  const warehouse = getFilter('warehouse') // storage_site id
  const unset = getFilter('unset') === '1' // 在庫だが保管先未設定のみ
  const warehouseName = warehouses.data?.results.find(
    (w) => String(w.id) === warehouse,
  )?.name
  // 在庫件数（部品マスタ列）・実物一覧に渡す倉庫パラメータ
  const stockParam = unset
    ? { storage_unset: 'true' }
    : warehouse
      ? { storage_site: warehouse }
      : {}

  // ---- 実物一覧の一括保管先設定（バックフィル）----
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkWarehouse, setBulkWarehouse] = useState('')
  const bulkSet = useCreate<{ updated: number }>('/part-units/bulk-set-storage/')

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const applyBulk = async () => {
    if (!bulkWarehouse || selected.size === 0) return
    try {
      const res = await bulkSet.mutateAsync({
        unit_ids: [...selected],
        storage_site: Number(bulkWarehouse),
      })
      toast.success(`${res.updated}件の保管先を設定しました`)
      setSelected(new Set())
      setBulkWarehouse('')
    } catch {
      toast.error('一括設定に失敗しました')
    }
  }

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
    ...stockParam,
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
          ...stockParam,
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
      header: unset ? '在庫(未設定)' : warehouseName ? `在庫(${warehouseName})` : '在庫',
      width: '96px',
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
    {
      key: 'select',
      header: '',
      width: '36px',
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleSelect(r.id)}
          aria-label={`${r.serial_number} を選択`}
        />
      ),
    },
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
      key: 'location',
      header: '現在の場所',
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
        ) : r.storage_site_name ? (
          <span>🏭 {r.storage_site_name}</span>
        ) : (
          <span style={{ color: 'var(--color-text-sub)' }}>未登録</span>
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

        {selected.size > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: '8px 12px',
              marginBottom: 8,
              borderRadius: 6,
              background: 'var(--aibod-pale, #eef2fb)',
              border: '1px solid var(--aibod-sky, #7fb3e6)',
            }}
          >
            <strong>{selected.size}件選択中</strong>
            <span style={{ color: 'var(--color-text-sub)' }}>
              保管先倉庫を一括設定:
            </span>
            <Select
              value={bulkWarehouse}
              onChange={(e) => setBulkWarehouse(e.target.value)}
            >
              <option value="">倉庫を選択</option>
              {warehouseOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={!bulkWarehouse || bulkSet.isPending}
              onClick={applyBulk}
            >
              適用
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelected(new Set())}
            >
              選択解除
            </Button>
          </div>
        )}

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
        <SelectFilter
          value={unset ? '' : warehouse}
          onChange={(v) => setFilters({ warehouse: v, unset: '' })}
          options={warehouseOptions}
          allLabel="全倉庫"
        />
        <Button
          variant={unset ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setFilters({ unset: unset ? '' : '1', warehouse: '' })}
        >
          保管先未設定のみ
        </Button>
      </FilterBar>
      {(warehouseName || unset) && (
        <p style={{ margin: '0 0 8px', color: 'var(--color-text-sub)' }}>
          「在庫」列は
          {unset ? ' 保管先未設定 ' : ` ${warehouseName} `}
          の在庫数を表示しています
        </p>
      )}

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
