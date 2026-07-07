/**
 * 製品セット設定 追加フォーム
 *
 * 設定は有効期間付きで追加し、既存行の上書きはしない
 * （effective-configs が最新の有効値を返す）。
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate } from '../../../api/hooks'
import type { BssSetConfig } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import {
  CheckboxLabel,
  Field,
  TextArea,
  TextInput,
} from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, dtLocalToIso } from '../../../lib/form-utils'

const schema = z.object({
  config_group: z.string().min(1, '設定グループを入力してください'),
  key: z.string().min(1, '設定キーを入力してください'),
  value: z.string(),
  is_secret: z.boolean(),
  valid_from: z.string(),
  valid_to: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  bssSetId: number
  onClose: () => void
}

export function SetConfigFormDrawer({ bssSetId, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<BssSetConfig>('/bss-set-configs/')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      config_group: '',
      key: '',
      value: '',
      is_secret: false,
      valid_from: '',
      valid_to: '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await create.mutateAsync({
        bss_set: bssSetId,
        config_group: values.config_group,
        key: values.key,
        value: values.value || null,
        is_secret: values.is_secret,
        valid_from: dtLocalToIso(values.valid_from),
        valid_to: dtLocalToIso(values.valid_to),
      })
      toast.success('設定を追加しました')
      onClose()
    } catch (err) {
      const { message, fields } = parseApiErrors(err)
      applyServerErrors(setError, fields)
      if (message) toast.error(message)
    }
  }

  return (
    <Drawer
      title="セット設定を追加"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            追加
          </Button>
        </>
      }
    >
      <Field label="設定グループ" required hint="例: POS, PAYPAY, NETWORK, SYSTEM" error={errors.config_group?.message}>
        <TextInput {...register('config_group')} />
      </Field>
      <Field label="設定キー" required hint="例: paypay_merchant_id" error={errors.key?.message}>
        <TextInput {...register('key')} />
      </Field>
      <Field label="設定値" error={errors.value?.message}>
        <TextArea {...register('value')} />
      </Field>
      <Field label="秘匿情報">
        <CheckboxLabel label="秘匿情報（APIレスポンスでマスクする）" {...register('is_secret')} />
      </Field>
      <Field label="有効開始日時" error={errors.valid_from?.message}>
        <TextInput type="datetime-local" {...register('valid_from')} />
      </Field>
      <Field label="有効終了日時" error={errors.valid_to?.message}>
        <TextInput type="datetime-local" {...register('valid_to')} />
      </Field>
    </Drawer>
  )
}
