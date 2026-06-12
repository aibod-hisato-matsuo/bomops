/**
 * 汎用データテーブル
 *
 * AIBODブランドの表デザイン（ヘッダー: スカイブルー背景×白文字、罫線: ブラック）。
 */

import type { ReactNode } from 'react'

import styles from './DataTable.module.css'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  loading?: boolean
  emptyText?: string
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyText = 'データがありません',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className={styles.state}>
                読み込み中...
              </td>
            </tr>
          )}
          {!loading && rows === undefined && (
            <tr>
              <td colSpan={columns.length} className={styles.state}>
                データを取得できません。接続を確認して再読み込みしてください
              </td>
            </tr>
          )}
          {!loading && rows && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={styles.state}>
                {emptyText}
              </td>
            </tr>
          )}
          {!loading &&
            rows?.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? styles.clickable : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>{col.render(row)}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
