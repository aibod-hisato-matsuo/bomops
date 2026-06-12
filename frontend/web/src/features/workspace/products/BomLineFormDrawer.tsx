/**
 * BOM行 追加フォーム
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList } from '../../../api/hooks'
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
  onClose: () => void
}

export function BomLineFormDrawer({ productModelId, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<ProductBOM>('/product-boms/')
  const masters = useList<PartMaster>('/part-masters/', {
    page_size: 200,
    is_active: true,
  })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { part_master: '', quantity: '1', is_optional: false },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await create.mutateAsync({
        product_model: productModelId,
        part_master: Number(values.part_master),
        quantity: Number(values.quantity),
        is_optional: values.is_optional,
      })
      toast.success('BOM行を追加しました')
      onClose()
    } catch (err) {
      const { message, fields } = parseApiErrors(err)
      applyServerErrors(setError, fields)
      if (message) toast.error(message)
    }
  }

  return (
    <Drawer
      title="BOM行を追加"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            追加
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
    </Drawer>
  )
}
