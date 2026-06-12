/**
 * DataTable のユニットテスト（描画状態の優先順位）
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DataTable, type Column } from './DataTable'

interface Row {
  id: number
  name: string
}

const columns: Column<Row>[] = [
  { key: 'id', header: 'ID', render: (r) => r.id },
  { key: 'name', header: '名前', render: (r) => r.name },
]

describe('DataTable', () => {
  it('loading 中は読み込み表示を出す', () => {
    render(<DataTable columns={columns} rows={undefined} rowKey={(r) => r.id} loading />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('取得失敗（rows未定義）では接続確認メッセージを出す（真っ白禁止）', () => {
    render(<DataTable columns={columns} rows={undefined} rowKey={(r) => r.id} />)
    expect(
      screen.getByText('データを取得できません。接続を確認して再読み込みしてください'),
    ).toBeInTheDocument()
  })

  it('0件のときは emptyText を出す', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyText="該当なし"
      />,
    )
    expect(screen.getByText('該当なし')).toBeInTheDocument()
  })

  it('行データとヘッダーを描画し、行クリックでコールバックする', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const rows: Row[] = [
      { id: 1, name: 'カメラ' },
      { id: 2, name: 'モニター' },
    ]
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    )

    expect(screen.getByText('名前')).toBeInTheDocument()
    expect(screen.getByText('カメラ')).toBeInTheDocument()

    await user.click(screen.getByText('モニター'))
    expect(onRowClick).toHaveBeenCalledWith(rows[1])
  })
})
