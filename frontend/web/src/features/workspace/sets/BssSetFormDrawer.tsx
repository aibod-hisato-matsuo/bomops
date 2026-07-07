/**
 * 製品セット 作成/編集フォーム
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList, useUpdate } from '../../../api/hooks'
import type { BssSet, CustomerSite, ProductModel } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, Select, TextArea, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import {
  applyServerErrors,
  cleanPayload,
  dtLocalToIso,
  isoToDtLocal,
} from '../../../lib/form-utils'

const schema = z.object({
  set_code: z.string().min(1, 'セットコードを入力してください'),
  product_model: z.string().min(1, '製品モデルを選択してください'),
  status: z.string(),
  customer_site: z.string(),
  installed_at: z.string(),
  removed_at: z.string(),
  note: z.string(),
})

type FormValues = z.infer<typeof schema>

const statusOptions = [
  { value: 'ASSEMBLED', label: '組立完了' },
  { value: 'INSTALLED', label: '設置済' },
  { value: 'REPAIR', label: '修理中' },
  { value: 'RECOVERED', label: '回収済' },
  { value: 'SCRAPPED', label: '廃棄' },
]

interface Props {
  item: BssSet | null
  onClose: () => void
}

export function BssSetFormDrawer({ item, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<BssSet>('/bss-sets/')
  const update = useUpdate<BssSet>('/bss-sets/')
  const models = useList<ProductModel>('/product-models/', { page_size: 200 })
  const sites = useList<CustomerSite>('/customer-sites/', { page_size: 200 })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      set_code: item?.set_code ?? '',
      product_model: item ? String(item.product_model) : '',
      status: item?.status ?? 'ASSEMBLED',
      customer_site: item?.customer_site ? String(item.customer_site) : '',
      installed_at: isoToDtLocal(item?.installed_at),
      removed_at: isoToDtLocal(item?.removed_at),
      note: item?.note ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const payload = cleanPayload({
      ...values,
      product_model: Number(values.product_model),
      customer_site: values.customer_site ? Number(values.customer_site) : '',
      installed_at: dtLocalToIso(values.installed_at) ?? '',
      removed_at: dtLocalToIso(values.removed_at) ?? '',
    })
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('製品セットを更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success('製品セットを作成しました')
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
      title={item ? `製品セット編集: ${item.set_code}` : '製品セット新規作成'}
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
      <Field label="セットコード" required error={errors.set_code?.message}>
        <TextInput placeholder="例: BST-2025-0010" {...register('set_code')} />
      </Field>
      <Field label="製品モデル" required error={errors.product_model?.message}>
        <Select {...register('product_model')}>
          <option value="">選択してください</option>
          {models.data?.results.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code}: {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="ステータス" error={errors.status?.message}>
        <Select {...register('status')}>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="設置拠点"
        hint="在庫・出張中の場合は未選択のまま"
        error={errors.customer_site?.message}
      >
        <Select {...register('customer_site')}>
          <option value="">未設置（在庫）</option>
          {sites.data?.results.map((s) => (
            <option key={s.id} value={s.id}>
              {s.customer_name} - {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="設置日時" error={errors.installed_at?.message}>
        <TextInput type="datetime-local" {...register('installed_at')} />
      </Field>
      <Field label="撤去日時" error={errors.removed_at?.message}>
        <TextInput type="datetime-local" {...register('removed_at')} />
      </Field>
      <Field label="備考" error={errors.note?.message}>
        <TextArea {...register('note')} />
      </Field>
    </Drawer>
  )
}
