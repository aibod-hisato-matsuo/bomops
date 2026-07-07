/**
 * 製品モデル 作成/編集フォーム
 *
 * ファミリはファミリマスタ（/product-families/）から選択する。
 * 「＋ 新規ファミリを追加…」を選ぶと名前入力欄が現れ、
 * 保存時にファミリを作成してからモデルを保存する。
 * グレード / バリエーションは自由入力（整備が進んだらマスタ昇格を検討）。
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList, useUpdate } from '../../../api/hooks'
import type { ProductFamily, ProductModel } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import { Field, Select, TextArea, TextInput } from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, cleanPayload } from '../../../lib/form-utils'

const NEW_FAMILY = '__new__'

const schema = z
  .object({
    code: z.string().min(1, '製品コードを入力してください'),
    name: z.string().min(1, '製品名を入力してください'),
    family: z.string(),
    new_family_name: z.string(),
    grade: z.string(),
    variation: z.string(),
    description: z.string(),
  })
  .refine(
    (v) => v.family !== NEW_FAMILY || v.new_family_name.trim() !== '',
    {
      path: ['new_family_name'],
      message: '新規ファミリ名を入力してください',
    },
  )

type FormValues = z.infer<typeof schema>

interface Props {
  item: ProductModel | null
  onClose: () => void
}

export function ProductModelFormDrawer({ item, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<ProductModel>('/product-models/')
  const update = useUpdate<ProductModel>('/product-models/')
  const createFamily = useCreate<ProductFamily>('/product-families/')
  const families = useList<ProductFamily>('/product-families/', {
    page_size: 200,
  })

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: item?.code ?? '',
      name: item?.name ?? '',
      family: item?.family != null ? String(item.family) : '',
      new_family_name: '',
      grade: item?.grade ?? '',
      variation: item?.variation ?? '',
      description: item?.description ?? '',
    },
  })

  const selectedFamily = useWatch({ control, name: 'family' })

  const onSubmit = async (values: FormValues) => {
    try {
      // 「＋ 新規ファミリ」の場合は先にファミリを作成してIDを得る
      let familyId: number | null
      if (values.family === NEW_FAMILY) {
        const created = await createFamily.mutateAsync({
          name: values.new_family_name.trim(),
        })
        familyId = created.id
      } else {
        familyId = values.family === '' ? null : Number(values.family)
      }

      const { new_family_name: _omit, ...rest } = values
      void _omit
      const payload = { ...cleanPayload(rest), family: familyId }

      if (item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('製品モデルを更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success('製品モデルを作成しました')
      }
      onClose()
    } catch (err) {
      const { message, fields } = parseApiErrors(err)
      // ファミリ作成時の name エラーは new_family_name 欄に表示する
      if (fields.name && values.family === NEW_FAMILY) {
        setError('new_family_name', { message: fields.name })
        delete fields.name
      }
      applyServerErrors(setError, fields)
      if (message) toast.error(message)
    }
  }

  return (
    <Drawer
      title={item ? `製品モデル編集: ${item.code}` : '製品モデル新規作成'}
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
      <Field label="製品コード" required error={errors.code?.message}>
        <TextInput placeholder="例: BSTAND-V1.2" {...register('code')} />
      </Field>
      <Field label="製品名" required error={errors.name?.message}>
        <TextInput {...register('name')} />
      </Field>
      <Field label="製品ファミリ" error={errors.family?.message}>
        <Select {...register('family')}>
          <option value="">（未設定）</option>
          {(families.data?.results ?? []).map((f) => (
            <option key={f.id} value={String(f.id)}>
              {f.name}
            </option>
          ))}
          <option value={NEW_FAMILY}>＋ 新規ファミリを追加…</option>
        </Select>
      </Field>
      {selectedFamily === NEW_FAMILY && (
        <Field
          label="新規ファミリ名"
          required
          error={errors.new_family_name?.message}
        >
          <TextInput
            placeholder="例: RISC-V Board"
            {...register('new_family_name')}
          />
        </Field>
      )}
      <Field label="グレード" error={errors.grade?.message}>
        <TextInput placeholder="例: AI / Mini / Pro" {...register('grade')} />
      </Field>
      <Field label="バリエーション" error={errors.variation?.message}>
        <TextInput placeholder="例: 8GB / LTE / 屋外用" {...register('variation')} />
      </Field>
      <Field label="説明" error={errors.description?.message}>
        <TextArea {...register('description')} />
      </Field>
    </Drawer>
  )
}
