/**
 * イベント追記フォーム（保守イベント / 導入イベント）
 *
 * 追記型のため編集・削除UIは存在しない。追記のみ。
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList } from '../../../api/hooks'
import type {
  BssSetComponent,
  DeployEvent,
  MaintenanceEvent,
} from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, Select, TextArea, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, dtLocalToIso, isoToDtLocal } from '../../../lib/form-utils'

const schema = z.object({
  kind: z.string(),
  part_unit: z.string(),
  occurred_at: z.string().min(1, '発生日時を入力してください'),
  note: z.string(),
})

type FormValues = z.infer<typeof schema>

const maintenanceKinds = [
  { value: 'FAILURE', label: '故障' },
  { value: 'REPLACEMENT', label: '交換' },
  { value: 'INSPECTION', label: '点検' },
  { value: 'CONFIG_CHANGE', label: '設定変更' },
]

const deployKinds = [
  { value: 'INSTALL', label: '設置' },
  { value: 'ACTIVATION', label: '開通' },
  { value: 'OPERATION', label: '稼働' },
  { value: 'RECOVERY', label: '回収' },
  { value: 'REASSEMBLY', label: '再組立' },
]

interface Props {
  bssSetId: number
  eventCategory: 'maintenance' | 'deploy'
  onClose: () => void
}

export function EventFormDrawer({ bssSetId, eventCategory, onClose }: Props) {
  const toast = useToast()
  const isMaintenance = eventCategory === 'maintenance'
  const createMaintenance = useCreate<MaintenanceEvent>('/maintenance-events/')
  const createDeploy = useCreate<DeployEvent>('/deploy-events/')
  const components = useList<BssSetComponent>('/bss-set-components/', {
    bss_set: bssSetId,
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
      kind: isMaintenance ? 'INSPECTION' : 'INSTALL',
      part_unit: '',
      occurred_at: isoToDtLocal(new Date().toISOString()),
      note: '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      if (isMaintenance) {
        await createMaintenance.mutateAsync({
          bss_set: bssSetId,
          event_type: values.kind,
          part_unit: values.part_unit ? Number(values.part_unit) : null,
          occurred_at: dtLocalToIso(values.occurred_at),
          note: values.note || null,
        })
      } else {
        await createDeploy.mutateAsync({
          bss_set: bssSetId,
          stage: values.kind,
          occurred_at: dtLocalToIso(values.occurred_at),
          note: values.note || null,
        })
      }
      toast.success('イベントを追記しました')
      onClose()
    } catch (err) {
      const { message, fields } = parseApiErrors(err)
      applyServerErrors(setError, fields)
      if (message) toast.error(message)
    }
  }

  return (
    <Drawer
      title={isMaintenance ? '保守イベントを追記' : '導入イベントを追記'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            追記
          </Button>
        </>
      }
    >
      <Field
        label={isMaintenance ? 'イベント種別' : 'ステージ'}
        required
        error={errors.kind?.message}
      >
        <Select {...register('kind')}>
          {(isMaintenance ? maintenanceKinds : deployKinds).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {isMaintenance && (
        <Field label="対象部品" hint="セット全体のイベントは未選択のまま" error={errors.part_unit?.message}>
          <Select {...register('part_unit')}>
            <option value="">対象なし（セット全体）</option>
            {components.data?.results.map((c) => (
              <option key={c.id} value={c.part_unit}>
                {c.serial_number} ({c.role ?? '-'})
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="発生日時" required error={errors.occurred_at?.message}>
        <TextInput type="datetime-local" {...register('occurred_at')} />
      </Field>
      <Field label="備考" error={errors.note?.message}>
        <TextArea {...register('note')} />
      </Field>
    </Drawer>
  )
}
