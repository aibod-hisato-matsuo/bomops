/**
 * 顧客拠点 作成/編集フォーム
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList, useUpdate } from '../../../api/hooks'
import type { Customer, CustomerSite } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, Select, TextArea, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, cleanPayload } from '../../../lib/form-utils'

const schema = z.object({
  customer: z.string().min(1, '顧客を選択してください'),
  name: z.string().min(1, '拠点名を入力してください'),
  lifecycle_status: z.string(),
  address: z.string(),
  timezone: z.string().min(1),
  note: z.string(),
})

type FormValues = z.infer<typeof schema>

const lifecycleOptions = [
  { value: 'PREPARING', label: '準備中' },
  { value: 'ACTIVE', label: '稼働中' },
  { value: 'WITHDRAWN', label: '撤退済' },
  { value: 'BASE', label: '拠点' },
  { value: 'LOANED', label: '貸出中' },
]

interface Props {
  item: CustomerSite | null
  onClose: () => void
}

export function SiteFormDrawer({ item, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<CustomerSite>('/customer-sites/')
  const update = useUpdate<CustomerSite>('/customer-sites/')
  const customers = useList<Customer>('/customers/', { page_size: 200 })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer: item ? String(item.customer) : '',
      name: item?.name ?? '',
      lifecycle_status: item?.lifecycle_status ?? 'PREPARING',
      address: item?.address ?? '',
      timezone: item?.timezone ?? 'Asia/Tokyo',
      note: item?.note ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const payload = cleanPayload({ ...values, customer: Number(values.customer) })
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('拠点を更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success('拠点を作成しました')
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
      title={item ? `拠点編集: ${item.name}` : '拠点新規作成'}
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
      <Field label="顧客" required error={errors.customer?.message}>
        <Select {...register('customer')}>
          <option value="">選択してください</option>
          {customers.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}: {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="拠点名" required error={errors.name?.message}>
        <TextInput placeholder="例: ○○工場売店" {...register('name')} />
      </Field>
      <Field label="ライフサイクル状態" error={errors.lifecycle_status?.message}>
        <Select {...register('lifecycle_status')}>
          {lifecycleOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="住所" error={errors.address?.message}>
        <TextInput {...register('address')} />
      </Field>
      <Field label="タイムゾーン" error={errors.timezone?.message}>
        <TextInput {...register('timezone')} />
      </Field>
      <Field label="備考" error={errors.note?.message}>
        <TextArea {...register('note')} />
      </Field>
    </Drawer>
  )
}
