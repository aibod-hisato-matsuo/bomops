/**
 * ソフトウェアマスタ 作成/編集フォーム
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useUpdate } from '../../../api/hooks'
import type { SoftwareMaster } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import {
  CheckboxLabel,
  Field,
  Select,
  TextArea,
  TextInput,
} from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, cleanPayload } from '../../../lib/form-utils'

const schema = z.object({
  code: z.string().min(1, 'ソフトウェアコードを入力してください'),
  name: z.string().min(1, 'ソフトウェア名を入力してください'),
  kind: z.string(),
  vendor: z.string(),
  description: z.string(),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const kindOptions = [
  { value: 'STACK', label: 'アプリスタック' },
  { value: 'FIRMWARE', label: 'ファームウェア' },
  { value: 'OS', label: 'OS' },
  { value: 'OTHER', label: 'その他' },
]

interface Props {
  item: SoftwareMaster | null
  onClose: () => void
}

export function SoftwareMasterFormDrawer({ item, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<SoftwareMaster>('/software-masters/')
  const update = useUpdate<SoftwareMaster>('/software-masters/')

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
      kind: item?.kind ?? 'STACK',
      vendor: item?.vendor ?? '',
      description: item?.description ?? '',
      is_active: item?.is_active ?? true,
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, payload: cleanPayload(values) })
        toast.success('ソフトウェアマスタを更新しました')
      } else {
        await create.mutateAsync(cleanPayload(values))
        toast.success('ソフトウェアマスタを作成しました')
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
      title={item ? `ソフトウェア編集: ${item.code}` : 'ソフトウェア新規作成'}
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
      <Field label="ソフトウェアコード" required error={errors.code?.message}>
        <TextInput placeholder="例: BSTAND-SW" {...register('code')} />
      </Field>
      <Field label="ソフトウェア名" required error={errors.name?.message}>
        <TextInput {...register('name')} />
      </Field>
      <Field label="種別" error={errors.kind?.message}>
        <Select {...register('kind')}>
          {kindOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="提供元" error={errors.vendor?.message}>
        <TextInput {...register('vendor')} />
      </Field>
      <Field label="説明" error={errors.description?.message}>
        <TextArea {...register('description')} />
      </Field>
      <Field label="有効フラグ">
        <CheckboxLabel label="有効" {...register('is_active')} />
      </Field>
    </Drawer>
  )
}
