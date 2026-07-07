/**
 * 部品マスタ一覧（W-2 / 3層構成）
 *
 * 上段: 部品グループ（主要/周辺/組立/その他）のボタン（件数付き）。
 * 中段: グループ選択時、その配下カテゴリのボタン（件数付き）。
 * 下段: グループ×カテゴリで絞り込んだ部品一覧テーブル。
 */

import { useState } from 'react'

import { useGet, useList } from '../../../api/hooks'
import type { PartMaster, PartMasterCategorySummary } from '../../../api/types'
import { Badge } from '../../../components/Badge'
import type { BadgeVariant } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '../../../components/FilterBar'
import { PageHeader } from '../../../components/PageHeader'
import { Pagination } from '../../../components/Pagination'
import { useListParams } from '../../../hooks/useListParams'
import { useSearchFilter } from '../shared/useSearchFilter'
import { PartMasterFormDrawer } from './PartMasterFormDrawer'
import styles from './PartMasterListPage.module.css'

const partGroups = [
  {
    value: 'MAIN',
    label: '主要部品',
    desc: 'PC・モニター・バーコード・決済端末・カメラ',
  },
  {
    value: 'PERIPHERAL',
    label: '周辺部品',
    desc: 'LTEルータ・ケーブル・保守用機器',
  },
  {
    value: 'ASSEMBLY',
    label: '組立部品',
    desc: '脚・アーム・天板・筐体（STAND組立用）',
  },
  { value: 'OTHER', label: 'その他', desc: '未分類' },
]

const partGroupVariant: Record<string, BadgeVariant> = {
  MAIN: 'sky',
  PERIPHERAL: 'pale',
  ASSEMBLY: 'navy',
  OTHER: 'gray',
}

const columns: Column<PartMaster>[] = [
  { key: 'part_code', header: '部品コード', render: (r) => r.part_code },
  { key: 'name', header: '部品名', render: (r) => r.name },
  {
    key: 'part_group',
    header: 'グループ',
    render: (r) => (
      <Badge variant={partGroupVariant[r.part_group ?? ''] ?? 'gray'}>
        {r.part_group_display}
      </Badge>
    ),
  },
  { key: 'category', header: 'カテゴリ', render: (r) => r.category_display },
  { key: 'maker', header: 'メーカー', render: (r) => r.maker ?? '-' },
  { key: 'model_number', header: '型番', render: (r) => r.model_number ?? '-' },
  {
    key: 'usage',
    header: '使用モデル',
    render: (r) => (
      <>
        {r.used_in_ai && <Badge variant="sky">AI</Badge>}{' '}
        {r.used_in_mini && <Badge variant="pale">Mini</Badge>}
        {!r.used_in_ai && !r.used_in_mini && '-'}
      </>
    ),
  },
  {
    key: 'is_active',
    header: '有効',
    render: (r) =>
      r.is_active ? <Badge variant="sky">有効</Badge> : <Badge variant="gray">無効</Badge>,
  },
]

export function PartMasterListPage() {
  const { params, page, setPage, setFilter, setFilters, getFilter } =
    useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const { data, isPending } = useList<PartMaster>('/part-masters/', params)
  const [editing, setEditing] = useState<PartMaster | 'new' | null>(null)

  // グループ×カテゴリの件数集計（グループボタン・カテゴリボタン両方の件数に使う）
  const summary = useGet<PartMasterCategorySummary[]>(
    '/part-masters/category-summary/',
  )
  const summaryRows = summary.data ?? []

  const activeGroup = getFilter('part_group')
  const activeCategory = getFilter('category')

  const groupCount = (group: string) =>
    summary.data === undefined
      ? undefined
      : summaryRows
          .filter((r) => r.part_group === group)
          .reduce((a, r) => a + r.count, 0)
  const totalCount =
    summary.data === undefined
      ? undefined
      : summaryRows.reduce((a, r) => a + r.count, 0)

  // 選択中グループ配下のカテゴリ内訳（件数降順はAPI側で整列済み）
  const activeGroupCategories = summaryRows.filter(
    (r) => r.part_group === activeGroup,
  )
  const activeGroupTotal = groupCount(activeGroup)

  const selectGroup = (group: string) => {
    // グループを切り替えたらカテゴリ絞り込みは解除する
    setFilters({ part_group: group, category: '' })
  }

  return (
    <div>
      <PageHeader
        title="部品マスタ"
        description="グループ → カテゴリの順にタップすると一覧が絞り込まれます（行クリックで編集）"
        actions={<Button onClick={() => setEditing('new')}>新規作成</Button>}
      />

      <div className={styles.groupRow}>
        <button
          type="button"
          className={
            activeGroup === ''
              ? `${styles.groupButton} ${styles.groupButtonActive}`
              : styles.groupButton
          }
          onClick={() => selectGroup('')}
        >
          <span className={styles.groupCount}>{totalCount ?? '…'}</span>
          <span className={styles.groupLabel}>全て</span>
          <span className={styles.groupDesc}>全グループを表示</span>
        </button>
        {partGroups.map((g) => (
          <button
            key={g.value}
            type="button"
            className={
              activeGroup === g.value
                ? `${styles.groupButton} ${styles.groupButtonActive}`
                : styles.groupButton
            }
            onClick={() => selectGroup(activeGroup === g.value ? '' : g.value)}
          >
            <span className={styles.groupCount}>
              {groupCount(g.value) ?? '…'}
            </span>
            <span className={styles.groupLabel}>{g.label}</span>
            <span className={styles.groupDesc}>{g.desc}</span>
          </button>
        ))}
      </div>

      {activeGroup !== '' && (
        <div className={styles.categoryRow}>
          <span className={styles.categoryRowLabel}>カテゴリ:</span>
          <button
            type="button"
            className={
              activeCategory === ''
                ? `${styles.categoryButton} ${styles.categoryButtonActive}`
                : styles.categoryButton
            }
            onClick={() => setFilter('category', '')}
          >
            全て
            <span className={styles.categoryCount}>{activeGroupTotal}</span>
          </button>
          {activeGroupCategories.map((c) => (
            <button
              key={c.category}
              type="button"
              className={
                activeCategory === c.category
                  ? `${styles.categoryButton} ${styles.categoryButtonActive}`
                  : styles.categoryButton
              }
              onClick={() =>
                setFilter(
                  'category',
                  activeCategory === c.category ? '' : c.category,
                )
              }
            >
              {c.category}
              <span className={styles.categoryCount}>{c.count}</span>
            </button>
          ))}
        </div>
      )}

      <FilterBar>
        <SearchInput
          value={text}
          onChange={setText}
          placeholder="部品コード・部品名・型番で検索"
        />
        <SelectFilter
          value={getFilter('is_active')}
          onChange={(v) => setFilter('is_active', v)}
          options={[
            { value: 'true', label: '有効のみ' },
            { value: 'false', label: '無効のみ' },
          ]}
          allLabel="有効/無効"
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
        <PartMasterFormDrawer
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
