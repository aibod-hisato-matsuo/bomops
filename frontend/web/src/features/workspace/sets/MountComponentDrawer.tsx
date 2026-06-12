/**
 * 構成部品の搭載フォーム
 *
 * 在庫部品を選択してセットに搭載する。
 * 搭載と同時に部品実物のステータスを「割当済」へ更新する。
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList, useUpdate } from '../../../api/hooks'
import type { BssSetComponent, PartUnit } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, Select, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors } from '../../../lib/form-utils'

const schema = z.object({
  part_unit: z.string().min(1, '部品実物を選択してください'),
  role: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  bssSetId: number
  onClose: () => void
}

export function MountComponentDrawer({ bssSetId, onClose }: Props) {
  const toast = useToast()
  const createComponent = useCreate<BssSetComponent>('/bss-set-components/')
  const updateUnit = useUpdate<PartUnit>('/part-units/')
  const stockUnits = useList<PartUnit>('/part-units/', {
    status: 'IN_STOCK',
    page_size: 200,
  })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { part_unit: '', role: '' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await createComponent.mutateAsync({
        bss_set: bssSetId,
        part_unit: Number(values.part_unit),
        role: values.role || null,
        mounted_at: new Date().toISOString(),
      })
      await updateUnit.mutateAsync({
        id: Number(values.part_unit),
        payload: { status: 'ASSIGNED' },
      })
      toast.success('部品を搭載しました')
      onClose()
    } catch (err) {
      const { message, fields } = parseApiErrors(err)
      applyServerErrors(setError, fields)
      if (message) toast.error(message)
    }
  }

  return (
    <Drawer
      title="部品を搭載"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            搭載
          </Button>
        </>
      }
    >
      <Field
        label="部品実物（在庫のみ）"
        required
        error={errors.part_unit?.message}
      >
        <Select {...register('part_unit')}>
          <option value="">選択してください</option>
          {stockUnits.data?.results.map((u) => (
            <option key={u.id} value={u.id}>
              {u.serial_number} ({u.part_master_code}: {u.part_master_name})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="役割" hint="例: MAIN_PC, CAMERA1, PAYMENT" error={errors.role?.message}>
        <TextInput {...register('role')} />
      </Field>
    </Drawer>
  )
}
