/**
 * 製品モデル一覧（W-4 / 4層カスケード構成）
 *
 * ファミリ → グレード → バリエーション のカスケードボタンで絞り込み、
 * 下段に該当モデルの一覧を表示する。値が存在しない層の行は表示しない。
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useGet, useList } from '../../../api/hooks'
import type {
  ProductModel,
  ProductModelHierarchySummary,
} from '../../../api/types'
import { Button } from '../../../components/Button'
import { CascadeRow } from '../../../components/CascadeRow'
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
  { key: 'family', header: 'ファミリ', render: (r) => r.family_name ?? '-' },
  { key: 'grade', header: 'グレード', render: (r) => r.grade ?? '-' },
  { key: 'variation', header: 'バリエーション', render: (r) => r.variation ?? '-' },
  { key: 'description', header: '説明', render: (r) => r.description ?? '-' },
]

/** 集計行から指定キーの値ごとの件数を集約する（null値は除外） */
function rollup(
  rows: ProductModelHierarchySummary[],
  key: 'family' | 'grade' | 'variation',
): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = row[key]
    if (value === null || value === undefined) continue
    counts.set(value, (counts.get(value) ?? 0) + row.count)
  }
  return Array.from(counts, ([value, count]) => ({
    value,
    label: value,
    count,
  })).sort((a, b) => b.count - a.count)
}

export function ProductModelListPage() {
  const navigate = useNavigate()
  const { params, page, setPage, setFilter, setFilters, getFilter } =
    useListParams()
  const { text, setText } = useSearchFilter(getFilter, setFilter)
  const { data, isPending } = useList<ProductModel>('/product-models/', params)
  const [creating, setCreating] = useState(false)

  const summary = useGet<ProductModelHierarchySummary[]>(
    '/product-models/hierarchy-summary/',
  )
  const summaryRows = summary.data ?? []

  const activeFamily = getFilter('family')
  const activeGrade = getFilter('grade')
  const activeVariation = getFilter('variation')

  // 各層の選択に応じて下層の集計対象を絞り込む
  const familyOptions = rollup(summaryRows, 'family')
  const familyRows = summaryRows.filter((r) => r.family === activeFamily)
  const gradeOptions = rollup(familyRows, 'grade')
  const gradeRows = familyRows.filter((r) => r.grade === activeGrade)
  const variationOptions = rollup(gradeRows, 'variation')

  const totalCount =
    summary.data === undefined
      ? undefined
      : summaryRows.reduce((a, r) => a + r.count, 0)
  const familyTotal = familyRows.reduce((a, r) => a + r.count, 0)
  const gradeTotal = gradeRows.reduce((a, r) => a + r.count, 0)

  return (
    <div>
      <PageHeader
        title="製品モデル"
        description="ファミリ → グレード → バリエーションの順にタップすると絞り込まれます（行クリックでBOM表示）"
        actions={<Button onClick={() => setCreating(true)}>新規作成</Button>}
      />

      <CascadeRow
        label="ファミリ:"
        options={familyOptions}
        active={activeFamily}
        allCount={totalCount}
        onChange={(v) => setFilters({ family: v, grade: '', variation: '' })}
      />

      {activeFamily !== '' && gradeOptions.length > 0 && (
        <CascadeRow
          label="グレード:"
          options={gradeOptions}
          active={activeGrade}
          allCount={familyTotal}
          onChange={(v) => setFilters({ grade: v, variation: '' })}
        />
      )}

      {activeGrade !== '' && variationOptions.length > 0 && (
        <CascadeRow
          label="バリエーション:"
          options={variationOptions}
          active={activeVariation}
          allCount={gradeTotal}
          onChange={(v) => setFilter('variation', v)}
        />
      )}

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
