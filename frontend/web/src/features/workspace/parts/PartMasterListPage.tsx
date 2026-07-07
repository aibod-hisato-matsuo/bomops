/**
 * 部品マスタ一覧（W-2 / 2層構成）
 *
 * 上段: 部品グループ（主要/周辺/組立/その他）のボタン（件数付き）。
 * 下段: 選択グループで絞り込んだ部品一覧テーブル。
 */

import { useState } from 'react'

import { useList } from '../../../api/hooks'
import type { PartCategory, PartMaster } from '../../../api/types'
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

/** グループごとの件数を取得する（page_size=1 で count のみ利用） */
function useGroupCount(group: string): number | undefined {
  const { data } = useList<PartMaster>('/part-masters/', {
    part_group: group,
    page_size: 1,
  })
  return data?.count
}

export function PartMasterListPage() {
  const { params, page, setPage, setFilter, getFilter } = useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const { data, isPending } = useList<PartMaster>('/part-masters/', params)
  const [editing, setEditing] = useState<PartMaster | 'new' | null>(null)

  const categories = useList<PartCategory>('/part-categories/', { page_size: 200 })
  const categoryOptions = (categories.data?.results ?? []).map((c) => ({
    value: c.name,
    label: c.name,
  }))

  const activeGroup = getFilter('part_group')
  const counts: Record<string, number | undefined> = {
    MAIN: useGroupCount('MAIN'),
    PERIPHERAL: useGroupCount('PERIPHERAL'),
    ASSEMBLY: useGroupCount('ASSEMBLY'),
    OTHER: useGroupCount('OTHER'),
  }
  const totalCount = Object.values(counts).every((c) => c !== undefined)
    ? Object.values(counts).reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
    : undefined

  return (
    <div>
      <PageHeader
        title="部品マスタ"
        description="グループを選ぶと下に該当部品の一覧が表示されます（行クリックで編集）"
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
          onClick={() => setFilter('part_group', '')}
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
            onClick={() =>
              setFilter('part_group', activeGroup === g.value ? '' : g.value)
            }
          >
            <span className={styles.groupCount}>{counts[g.value] ?? '…'}</span>
            <span className={styles.groupLabel}>{g.label}</span>
            <span className={styles.groupDesc}>{g.desc}</span>
          </button>
        ))}
      </div>

      <FilterBar>
        <SearchInput
          value={text}
          onChange={setText}
          placeholder="部品コード・部品名・型番で検索"
        />
        <SelectFilter
          value={getFilter('category')}
          onChange={(v) => setFilter('category', v)}
          options={categoryOptions}
          allLabel="全カテゴリ"
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
