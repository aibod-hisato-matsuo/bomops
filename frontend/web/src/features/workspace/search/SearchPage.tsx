/**
 * 横断検索（W-9）
 *
 * シリアル番号逆引き＋部品実物・製品セット・拠点・顧客の横断検索。
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useGet, useList } from '../../../api/hooks'
import type {
  BssSet,
  Customer,
  CustomerSite,
  LookupBySerial,
  PartUnit,
} from '../../../api/types'
import { Badge } from '../../../components/Badge'
import {
  bssSetStatusVariant,
  lifecycleStatusVariant,
  partUnitStatusVariant,
} from '../../../components/badge-variants'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { Section } from '../../../components/DescList'
import { PageHeader } from '../../../components/PageHeader'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import styles from './SearchPage.module.css'

export function SearchPage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const query = useDebouncedValue(text.trim())
  const hasQuery = query.length >= 2

  // シリアル完全一致の逆引き（部品の現在地）
  const lookup = useGet<LookupBySerial>(
    hasQuery ? `/lookup/by-serial/?serial_number=${encodeURIComponent(query)}` : null,
  )

  // 横断検索（部分一致）
  const units = useList<PartUnit>('/part-units/', hasQuery ? { search: query, page_size: 10 } : {})
  const sets = useList<BssSet>('/bss-sets/', hasQuery ? { search: query, page_size: 10 } : {})
  const sites = useList<CustomerSite>('/customer-sites/', hasQuery ? { search: query, page_size: 10 } : {})
  const customers = useList<Customer>('/customers/', hasQuery ? { search: query, page_size: 10 } : {})

  const unitColumns: Column<PartUnit>[] = [
    { key: 'serial_number', header: 'シリアル番号', render: (r) => r.serial_number },
    { key: 'part', header: '部品', render: (r) => `${r.part_master_code}: ${r.part_master_name}` },
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

  const setColumns: Column<BssSet>[] = [
    { key: 'set_code', header: 'セットコード', render: (r) => r.set_code },
    {
      key: 'status',
      header: 'ステータス',
      render: (r) => (
        <Badge variant={bssSetStatusVariant[r.status ?? ''] ?? 'pale'}>
          {r.status_display}
        </Badge>
      ),
    },
    { key: 'site', header: '設置先', render: (r) => r.customer_site_name ?? '-' },
  ]

  const siteColumns: Column<CustomerSite>[] = [
    { key: 'name', header: '拠点名', render: (r) => r.name },
    { key: 'customer', header: '顧客', render: (r) => r.customer_name },
    {
      key: 'status',
      header: '状態',
      render: (r) => (
        <Badge variant={lifecycleStatusVariant[r.lifecycle_status ?? ''] ?? 'pale'}>
          {r.lifecycle_status_display}
        </Badge>
      ),
    },
  ]

  const customerColumns: Column<Customer>[] = [
    { key: 'code', header: '顧客コード', render: (r) => r.code },
    { key: 'name', header: '顧客名', render: (r) => r.name },
    { key: 'sites_count', header: '拠点数', render: (r) => r.sites_count },
  ]

  return (
    <div>
      <PageHeader
        title="検索"
        description="シリアル番号・コード・名称で横断検索します（2文字以上で検索開始）"
      />

      <input
        type="search"
        className={styles.bigSearch}
        placeholder="シリアル番号・セットコード・拠点名・顧客名..."
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />

      {!hasQuery && (
        <p className={styles.placeholder}>
          検索キーワードを入力してください
        </p>
      )}

      {hasQuery && lookup.data && (
        <Section title="シリアル番号 完全一致">
          <div className={styles.lookupCard}>
            <div className={styles.lookupRow}>
              <span className={styles.lookupLabel}>部品</span>
              <span>
                {lookup.data.serial_number}（{lookup.data.part_master}）
              </span>
            </div>
            <div className={styles.lookupRow}>
              <span className={styles.lookupLabel}>現在のセット</span>
              <span>
                {lookup.data.current_set
                  ? `${lookup.data.current_set.set_code}（${lookup.data.current_set.status}）`
                  : '未搭載'}
              </span>
            </div>
            <div className={styles.lookupRow}>
              <span className={styles.lookupLabel}>現在の設置先</span>
              <span>
                {lookup.data.current_site
                  ? `${lookup.data.current_site.customer} - ${lookup.data.current_site.site}`
                  : '-'}
              </span>
            </div>
            <div className={styles.lookupActions}>
              <Link to={`/workspace/part-units/${lookup.data.part_unit_id}/history`}>
                使用履歴を見る
              </Link>
            </div>
          </div>
        </Section>
      )}

      {hasQuery && (
        <div className={styles.results}>
          <Section title={`部品実物（${units.data?.count ?? 0}件）`}>
            <DataTable
              columns={unitColumns}
              rows={units.data?.results}
              rowKey={(r) => r.id}
              loading={units.isPending}
              emptyText="該当なし"
            />
          </Section>
          <Section title={`製品セット（${sets.data?.count ?? 0}件）`}>
            <DataTable
              columns={setColumns}
              rows={sets.data?.results}
              rowKey={(r) => r.id}
              loading={sets.isPending}
              emptyText="該当なし"
              onRowClick={(r) => navigate(`/workspace/sets/${r.id}`)}
            />
          </Section>
          <Section title={`拠点（${sites.data?.count ?? 0}件）`}>
            <DataTable
              columns={siteColumns}
              rows={sites.data?.results}
              rowKey={(r) => r.id}
              loading={sites.isPending}
              emptyText="該当なし"
            />
          </Section>
          <Section title={`顧客（${customers.data?.count ?? 0}件）`}>
            <DataTable
              columns={customerColumns}
              rows={customers.data?.results}
              rowKey={(r) => r.id}
              loading={customers.isPending}
              emptyText="該当なし"
            />
          </Section>
        </div>
      )}
    </div>
  )
}
