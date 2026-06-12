/**
 * 顧客 作成/編集フォーム
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useUpdate } from '../../../api/hooks'
import type { Customer } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, TextArea, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, cleanPayload } from '../../../lib/form-utils'

const schema = z.object({
  code: z.string().min(1, '顧客コードを入力してください'),
  name: z.string().min(1, '顧客名を入力してください'),
  contact_person: z.string(),
  contact_email: z.string().email('メールアドレスの形式が不正です').or(z.literal('')),
  contact_tel: z.string(),
  note: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  item: Customer | null
  onClose: () => void
}

export function CustomerFormDrawer({ item, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<Customer>('/customers/')
  const update = useUpdate<Customer>('/customers/')

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
      contact_person: item?.contact_person ?? '',
      contact_email: item?.contact_email ?? '',
      contact_tel: item?.contact_tel ?? '',
      note: item?.note ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const payload = cleanPayload(values)
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('顧客を更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success('顧客を作成しました')
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
      title={item ? `顧客編集: ${item.code}` : '顧客新規作成'}
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
      <Field label="顧客コード" required error={errors.code?.message}>
        <TextInput placeholder="例: CUST-001" {...register('code')} />
      </Field>
      <Field label="顧客名" required error={errors.name?.message}>
        <TextInput {...register('name')} />
      </Field>
      <Field label="担当者名" error={errors.contact_person?.message}>
        <TextInput {...register('contact_person')} />
      </Field>
      <Field label="連絡先メール" error={errors.contact_email?.message}>
        <TextInput type="email" {...register('contact_email')} />
      </Field>
      <Field label="連絡先電話番号" error={errors.contact_tel?.message}>
        <TextInput {...register('contact_tel')} />
      </Field>
      <Field label="備考" error={errors.note?.message}>
        <TextArea {...register('note')} />
      </Field>
    </Drawer>
  )
}
