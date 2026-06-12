/**
 * 製品モデル 作成/編集フォーム
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useUpdate } from '../../../api/hooks'
import type { ProductModel } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, TextArea, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, cleanPayload } from '../../../lib/form-utils'

const schema = z.object({
  code: z.string().min(1, '製品コードを入力してください'),
  name: z.string().min(1, '製品名を入力してください'),
  description: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  item: ProductModel | null
  onClose: () => void
}

export function ProductModelFormDrawer({ item, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<ProductModel>('/product-models/')
  const update = useUpdate<ProductModel>('/product-models/')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: item?.code ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const payload = cleanPayload(values)
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('製品モデルを更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success('製品モデルを作成しました')
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
      title={item ? `製品モデル編集: ${item.code}` : '製品モデル新規作成'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {item ? '更新' : '作成'}
          </Button>
        </>
      }
    >
      <Field label="製品コード" required error={errors.code?.message}>
        <TextInput placeholder="例: BSTAND-V1.2" {...register('code')} />
      </Field>
      <Field label="製品名" required error={errors.name?.message}>
        <TextInput {...register('name')} />
      </Field>
      <Field label="説明" error={errors.description?.message}>
        <TextArea {...register('description')} />
      </Field>
    </Drawer>
  )
}
