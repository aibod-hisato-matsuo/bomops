/**
 * ソフトウェアバージョン 作成/編集フォーム
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useUpdate } from '../../../api/hooks'
import type { SoftwareVersion } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, Select, TextArea, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, cleanPayload } from '../../../lib/form-utils'

const schema = z.object({
  version: z.string().min(1, 'バージョンを入力してください'),
  status: z.string(),
  release_date: z.string(),
  artifact_ref: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

const statusOptions = [
  { value: 'RELEASED', label: 'リリース' },
  { value: 'BETA', label: 'ベータ' },
  { value: 'DEPRECATED', label: '非推奨' },
]

interface Props {
  softwareId: number
  item: SoftwareVersion | null
  onClose: () => void
}

export function SoftwareVersionFormDrawer({ softwareId, item, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<SoftwareVersion>('/software-versions/')
  const update = useUpdate<SoftwareVersion>('/software-versions/')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      version: item?.version ?? '',
      status: item?.status ?? 'RELEASED',
      release_date: item?.release_date ?? '',
      artifact_ref: item?.artifact_ref ?? '',
      notes: item?.notes ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const payload = cleanPayload({ ...values, software: softwareId })
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('バージョンを更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success('バージョンを追加しました')
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
      title={item ? `バージョン編集: ${item.version}` : 'バージョン追加'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {item ? '更新' : '追加'}
          </Button>
        </>
      }
    >
      <Field label="バージョン" required error={errors.version?.message}>
        <TextInput placeholder="例: 2.3.1" {...register('version')} />
      </Field>
      <Field label="状態" error={errors.status?.message}>
        <Select {...register('status')}>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="リリース日" error={errors.release_date?.message}>
        <TextInput type="date" {...register('release_date')} />
      </Field>
      <Field
        label="アーティファクト参照"
        hint="git tag / commit hash / 配布URL 等"
        error={errors.artifact_ref?.message}
      >
        <TextInput {...register('artifact_ref')} />
      </Field>
      <Field label="リリースノート" error={errors.notes?.message}>
        <TextArea {...register('notes')} />
      </Field>
    </Drawer>
  )
}
