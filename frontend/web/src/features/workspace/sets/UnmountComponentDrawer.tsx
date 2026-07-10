/**
 * 部品の取外し（withdraw）フォーム
 *
 * セットから部品を外す際に、取外し後のステータス・保管先倉庫・保守イベント記録を
 * まとめて指定する。故障で外した部品が誤って「在庫」に戻る問題を解消し、
 * 外した部品の物理的な置き先（倉庫）を常に記録する。
 */

import { useState } from 'react'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList, useUpdate } from '../../../api/hooks'
import type {
  BssSetComponent,
  CustomerSite,
  MaintenanceEvent,
  PartUnit,
} from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { CheckboxLabel, Field, Select, TextArea } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'

const statusOptions = [
  { value: 'IN_STOCK', label: '在庫（再利用可）' },
  { value: 'BROKEN', label: '故障' },
  { value: 'SCRAPPED', label: '廃棄' },
]

interface Props {
  bssSetId: number
  component: BssSetComponent
  onClose: () => void
}

export function UnmountComponentDrawer({ bssSetId, component, onClose }: Props) {
  const toast = useToast()
  const updateComponent = useUpdate<BssSetComponent>('/bss-set-components/')
  const updateUnit = useUpdate<PartUnit>('/part-units/')
  const createEvent = useCreate<MaintenanceEvent>('/maintenance-events/')
  // 倉庫＝lifecycle_status=BASE（拠点）の拠点
  const warehouses = useList<CustomerSite>('/customer-sites/', {
    lifecycle_status: 'BASE',
    page_size: 200,
  })

  const [status, setStatus] = useState('IN_STOCK')
  const [storageSite, setStorageSite] = useState('')
  const [storageError, setStorageError] = useState('')
  const [note, setNote] = useState('')
  const [recordEvent, setRecordEvent] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async () => {
    // 在庫に戻す場合は保管先倉庫が必須（在庫の所在は重要情報のため）
    if (status === 'IN_STOCK' && !storageSite) {
      setStorageError('在庫に戻すには保管先倉庫が必須です')
      return
    }
    setStorageError('')
    setSubmitting(true)
    try {
      // 1. 取外し（搭載終了）
      await updateComponent.mutateAsync({
        id: component.id,
        payload: { unmounted_at: new Date().toISOString() },
      })
      // 2. 部品の状態と保管先を更新
      await updateUnit.mutateAsync({
        id: component.part_unit,
        payload: {
          status,
          storage_site: storageSite ? Number(storageSite) : null,
        },
      })
      // 3. 追記型の保守イベントを記録（任意）
      if (recordEvent) {
        await createEvent.mutateAsync({
          bss_set: bssSetId,
          part_unit: component.part_unit,
          event_type: status === 'BROKEN' ? 'FAILURE' : 'REPLACEMENT',
          note: note || null,
        })
      }
      toast.success('部品を取り外しました')
      onClose()
    } catch (err) {
      const { message } = parseApiErrors(err)
      toast.error(message ?? '取り外しに失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      title={`取外し: ${component.serial_number}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="danger" onClick={onSubmit} disabled={submitting}>
            取り外す
          </Button>
        </>
      }
    >
      <Field label="取外し後のステータス" required>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="保管先倉庫"
        required={status === 'IN_STOCK'}
        hint="外した部品の置き先（AIBOD拠点＝倉庫）。在庫に戻す場合は必須"
        error={storageError || undefined}
      >
        <Select
          value={storageSite}
          onChange={(e) => {
            setStorageSite(e.target.value)
            if (e.target.value) setStorageError('')
          }}
        >
          <option value="">未選択</option>
          {(warehouses.data?.results ?? []).map((w) => (
            <option key={w.id} value={String(w.id)}>
              {w.customer_name} - {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="保守イベント記録">
        <CheckboxLabel
          label={
            status === 'BROKEN'
              ? '故障イベントとして履歴に残す'
              : '交換イベントとして履歴に残す'
          }
          checked={recordEvent}
          onChange={(e) => setRecordEvent(e.target.checked)}
        />
      </Field>
      <Field label="備考">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Drawer>
  )
}
