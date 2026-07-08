/**
 * 部品実物 作成/編集フォーム
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList, useUpdate } from '../../../api/hooks'
import type { CustomerSite, PartMaster, PartUnit } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, Select, TextArea, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, cleanPayload } from '../../../lib/form-utils'

const schema = z.object({
  part_master: z.string().min(1, '部品マスタを選択してください'),
  serial_number: z.string().min(1, 'シリアル番号を入力してください'),
  status: z.string(),
  storage_site: z.string(),
  purchase_date: z.string(),
  purchase_order_no: z.string(),
  note: z.string(),
})

type FormValues = z.infer<typeof schema>

const statusOptions = [
  { value: 'IN_STOCK', label: '在庫' },
  { value: 'ASSIGNED', label: '割当済' },
  { value: 'BROKEN', label: '故障' },
  { value: 'SCRAPPED', label: '廃棄' },
]

interface Props {
  item: PartUnit | null
  onClose: () => void
  /** 新規作成時に部品マスタを初期選択する（実物一覧フレームからの作成用） */
  defaultPartMasterId?: number
}

export function PartUnitFormDrawer({ item, onClose, defaultPartMasterId }: Props) {
  const toast = useToast()
  const create = useCreate<PartUnit>('/part-units/')
  const update = useUpdate<PartUnit>('/part-units/')
  const masters = useList<PartMaster>('/part-masters/', {
    page_size: 200,
    is_active: true,
  })
  const warehouses = useList<CustomerSite>('/customer-sites/', {
    lifecycle_status: 'BASE',
    page_size: 200,
  })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      part_master: item
        ? String(item.part_master)
        : defaultPartMasterId
          ? String(defaultPartMasterId)
          : '',
      serial_number: item?.serial_number ?? '',
      status: item?.status ?? 'IN_STOCK',
      storage_site: item?.storage_site ? String(item.storage_site) : '',
      purchase_date: item?.purchase_date ?? '',
      purchase_order_no: item?.purchase_order_no ?? '',
      note: item?.note ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const payload = cleanPayload({
      ...values,
      part_master: Number(values.part_master),
      storage_site: values.storage_site ? Number(values.storage_site) : null,
    })
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('部品実物を更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success('部品実物を作成しました')
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
      title={item ? `部品実物編集: ${item.serial_number}` : '部品実物新規作成'}
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
      <Field label="シリアル番号" required error={errors.serial_number?.message}>
        <TextInput {...register('serial_number')} />
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
      <Field label="保管先倉庫" hint="未搭載時の置き先（AIBOD拠点＝倉庫）">
        <Select {...register('storage_site')}>
          <option value="">未選択</option>
          {(warehouses.data?.results ?? []).map((w) => (
            <option key={w.id} value={String(w.id)}>
              {w.customer_name} - {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="購入日" error={errors.purchase_date?.message}>
        <TextInput type="date" {...register('purchase_date')} />
      </Field>
      <Field label="発注番号" error={errors.purchase_order_no?.message}>
        <TextInput {...register('purchase_order_no')} />
      </Field>
      <Field label="備考" error={errors.note?.message}>
        <TextArea {...register('note')} />
      </Field>
    </Drawer>
  )
}
