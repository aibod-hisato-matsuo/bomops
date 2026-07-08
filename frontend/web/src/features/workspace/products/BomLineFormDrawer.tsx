/**
 * BOM行 追加/編集/複製フォーム
 *
 * - 追加: 空の状態から新規作成
 * - 編集: 既存行の部品・数量・区分を変更
 * - 複製: 既存行の値を初期値に新規作成（部品を変えて似た行を素早く作る用途）
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList, useUpdate } from '../../../api/hooks'
import type { PartMaster, ProductBOM } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import {
  CheckboxLabel,
  Field,
  Select,
  TextInput,
} from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors } from '../../../lib/form-utils'

const schema = z.object({
  part_master: z.string().min(1, '部品マスタを選択してください'),
  quantity: z.string().regex(/^[1-9]\d*$/, '1以上の整数を指定してください'),
  is_optional: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  productModelId: number
  /** 編集・複製の元になる既存行（新規追加時は null） */
  item?: ProductBOM | null
  /** true なら item を初期値として新規作成（複製） */
  duplicate?: boolean
  onClose: () => void
}

export function BomLineFormDrawer({
  productModelId,
  item = null,
  duplicate = false,
  onClose,
}: Props) {
  const toast = useToast()
  const create = useCreate<ProductBOM>('/product-boms/')
  const update = useUpdate<ProductBOM>('/product-boms/')
  const masters = useList<PartMaster>('/part-masters/', {
    page_size: 200,
    is_active: true,
  })

  const isEdit = item !== null && !duplicate
  const title = isEdit ? 'BOM行を編集' : duplicate ? 'BOM行を複製' : 'BOM行を追加'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      part_master: item ? String(item.part_master) : '',
      quantity: item ? String(item.quantity ?? 1) : '1',
      is_optional: item?.is_optional ?? false,
    },
  })

  const onSubmit = async (values: FormValues) => {
    const payload = {
      product_model: productModelId,
      part_master: Number(values.part_master),
      quantity: Number(values.quantity),
      is_optional: values.is_optional,
    }
    try {
      if (isEdit && item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('BOM行を更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success(duplicate ? 'BOM行を複製しました' : 'BOM行を追加しました')
      }
      onClose()
    } catch (err) {
      const { message, fields } = parseApiErrors(err)
      applyServerErrors(setError, fields)
      if (message) toast.error(message)
    }
  }

  return (
    <Drawer
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isEdit ? '更新' : duplicate ? '複製して追加' : '追加'}
          </Button>
        </>
      }
    >
      <Field label="部品マスタ" required error={errors.part_master?.message}>
        <Select {...register('part_master')}>
          <option value="">選択してください</option>
          {masters.data?.results.map((m) => (
            <option key={m.id} value={m.id}>
              {m.part_code}: {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="数量" required error={errors.quantity?.message}>
        <TextInput type="number" min={1} {...register('quantity')} />
      </Field>
      <Field label="区分">
        <CheckboxLabel label="オプション部品" {...register('is_optional')} />
      </Field>
      {duplicate && (
        <p style={{ fontSize: 12, color: 'var(--color-text-sub)' }}>
          ※ 同じ部品のまま追加すると重複エラーになります。部品マスタを変更してください。
        </p>
      )}
    </Drawer>
  )
}
