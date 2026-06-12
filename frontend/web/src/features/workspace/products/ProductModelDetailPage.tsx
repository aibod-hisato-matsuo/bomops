/**
 * 製品モデル詳細（W-4）— 基本情報とBOM構成表の編集
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { parseApiErrors } from '../../../api/errors'
import { useDelete, useDetail, useList } from '../../../api/hooks'
import type { ProductBOM, ProductModel } from '../../../api/types'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { DataTable, type Column } from '../../../components/DataTable'
import { DescList, Section } from '../../../components/DescList'
import { PageHeader } from '../../../components/PageHeader'
import { useToast } from '../../../components/toast/toast-context'
import { BomLineFormDrawer } from './BomLineFormDrawer'
import { ProductModelFormDrawer } from './ProductModelFormDrawer'

export function ProductModelDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data: model, isPending } = useDetail<ProductModel>('/product-models/', id)
  const { data: bom } = useList<ProductBOM>('/product-boms/', {
    product_model: id,
    page_size: 200,
  })
  const deleteBomLine = useDelete('/product-boms/')
  const [editing, setEditing] = useState(false)
  const [addingBomLine, setAddingBomLine] = useState(false)

  const handleDeleteBomLine = async (line: ProductBOM) => {
    if (!window.confirm(`BOM行「${line.part_master_code}」を削除しますか？`)) return
    try {
      await deleteBomLine.mutateAsync(line.id)
      toast.success('BOM行を削除しました')
    } catch (err) {
      const { message } = parseApiErrors(err)
      toast.error(message ?? '削除に失敗しました')
    }
  }

  const bomColumns: Column<ProductBOM>[] = [
    { key: 'part_master_code', header: '部品コード', render: (r) => r.part_master_code },
    { key: 'part_master_name', header: '部品名', render: (r) => r.part_master_name },
    { key: 'quantity', header: '数量', render: (r) => r.quantity ?? 1 },
    {
      key: 'is_optional',
      header: '区分',
      render: (r) =>
        r.is_optional ? (
          <Badge variant="gray">オプション</Badge>
        ) : (
          <Badge variant="pale">標準</Badge>
        ),
    },
    {
      key: 'actions',
      header: '操作',
      width: '80px',
      render: (r) => (
        <Button variant="danger" size="sm" onClick={() => handleDeleteBomLine(r)}>
          削除
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={model ? `製品モデル: ${model.code}` : '製品モデル'}
        description={model?.name}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              編集
            </Button>
            <Link to="/workspace/product-models">一覧へ戻る</Link>
          </>
        }
      />

      {isPending && <p>読み込み中...</p>}

      {model && (
        <Section title="基本情報">
          <DescList
            items={[
              { label: '製品コード', value: model.code },
              { label: '製品名', value: model.name },
              { label: '説明', value: model.description },
              { label: '作成日時', value: model.created_at },
            ]}
          />
        </Section>
      )}

      <Section title="BOM構成表">
        <div style={{ marginBottom: 10 }}>
          <Button size="sm" onClick={() => setAddingBomLine(true)}>
            BOM行を追加
          </Button>
        </div>
        <DataTable
          columns={bomColumns}
          rows={bom?.results}
          rowKey={(r) => r.id}
          emptyText="BOMが未定義です"
        />
      </Section>

      {editing && model && (
        <ProductModelFormDrawer item={model} onClose={() => setEditing(false)} />
      )}
      {addingBomLine && model && (
        <BomLineFormDrawer
          productModelId={model.id}
          onClose={() => setAddingBomLine(false)}
        />
      )}
    </div>
  )
}
