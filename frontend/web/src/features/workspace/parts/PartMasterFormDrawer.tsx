/**
 * 部品マスタ 作成/編集フォーム
 *
 * カテゴリはカテゴリマスタ（/part-categories/）から選択する。
 * 「＋ 新規カテゴリを追加…」を選ぶと名前入力欄が現れ、
 * 保存時にカテゴリを作成してから部品を保存する。
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useList, useUpdate } from '../../../api/hooks'
import type { PartCategory, PartMaster } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Drawer } from '../../../components/Drawer'
import {
  CheckboxLabel,
  Field,
  Select,
  TextInput,
} from '../../../components/form/Field'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors, cleanPayload } from '../../../lib/form-utils'

const NEW_CATEGORY = '__new__'

const schema = z
  .object({
    part_code: z.string().min(1, '部品コードを入力してください'),
    name: z.string().min(1, '部品名を入力してください'),
    part_group: z.string(),
    category: z.string().min(1, 'カテゴリを選択してください'),
    new_category_name: z.string(),
    maker: z.string(),
    model_number: z.string(),
    size: z.string(),
    is_active: z.boolean(),
  })
  .refine(
    (v) => v.category !== NEW_CATEGORY || v.new_category_name.trim() !== '',
    {
      path: ['new_category_name'],
      message: '新規カテゴリ名を入力してください',
    },
  )

type FormValues = z.infer<typeof schema>

const partGroupOptions = [
  { value: 'MAIN', label: '主要部品' },
  { value: 'PERIPHERAL', label: '周辺部品' },
  { value: 'ASSEMBLY', label: '組立部品' },
  { value: 'OTHER', label: 'その他' },
]

interface Props {
  item: PartMaster | null
  onClose: () => void
}

export function PartMasterFormDrawer({ item, onClose }: Props) {
  const toast = useToast()
  const create = useCreate<PartMaster>('/part-masters/')
  const update = useUpdate<PartMaster>('/part-masters/')
  const createCategory = useCreate<PartCategory>('/part-categories/')
  const categories = useList<PartCategory>('/part-categories/', {
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
      part_code: item?.part_code ?? '',
      name: item?.name ?? '',
      part_group: item?.part_group ?? 'OTHER',
      category: item ? String(item.category) : '',
      new_category_name: '',
      maker: item?.maker ?? '',
      model_number: item?.model_number ?? '',
      size: item?.size ?? '',
      is_active: item?.is_active ?? true,
    },
  })

  const selectedCategory = useWatch({ control, name: 'category' })

  const onSubmit = async (values: FormValues) => {
    try {
      // 「＋ 新規カテゴリ」の場合は先にカテゴリを作成してIDを得る
      let categoryId: number
      if (values.category === NEW_CATEGORY) {
        const created = await createCategory.mutateAsync({
          name: values.new_category_name.trim(),
        })
        categoryId = created.id
      } else {
        categoryId = Number(values.category)
      }

      const { new_category_name: _omit, ...rest } = values
      void _omit
      const payload = { ...cleanPayload(rest), category: categoryId }

      if (item) {
        await update.mutateAsync({ id: item.id, payload })
        toast.success('部品マスタを更新しました')
      } else {
        await create.mutateAsync(payload)
        toast.success('部品マスタを作成しました')
      }
      onClose()
    } catch (err) {
      const { message, fields } = parseApiErrors(err)
      // カテゴリ作成時の name エラーは new_category_name 欄に表示する
      if (fields.name && values.category === NEW_CATEGORY) {
        setError('new_category_name', { message: fields.name })
        delete fields.name
      }
      applyServerErrors(setError, fields)
      if (message) toast.error(message)
    }
  }

  return (
    <Drawer
      title={item ? `部品マスタ編集: ${item.part_code}` : '部品マスタ新規作成'}
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
      <Field label="部品コード" required error={errors.part_code?.message}>
        <TextInput placeholder="例: CAM-USB-001" {...register('part_code')} />
      </Field>
      <Field label="部品名" required error={errors.name?.message}>
        <TextInput {...register('name')} />
      </Field>
      <Field label="部品グループ" error={errors.part_group?.message}>
        <Select {...register('part_group')}>
          {partGroupOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="カテゴリ" required error={errors.category?.message}>
        <Select {...register('category')}>
          <option value="">選択してください</option>
          {(categories.data?.results ?? []).map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY}>＋ 新規カテゴリを追加…</option>
        </Select>
      </Field>
      {selectedCategory === NEW_CATEGORY && (
        <Field
          label="新規カテゴリ名"
          required
          error={errors.new_category_name?.message}
        >
          <TextInput
            placeholder="例: キーボード"
            {...register('new_category_name')}
          />
        </Field>
      )}
      <Field label="メーカー" error={errors.maker?.message}>
        <TextInput {...register('maker')} />
      </Field>
      <Field label="型番" error={errors.model_number?.message}>
        <TextInput {...register('model_number')} />
      </Field>
      <Field label="サイズ" error={errors.size?.message}>
        <TextInput {...register('size')} />
      </Field>
      <Field label="有効フラグ">
        <CheckboxLabel label="有効" {...register('is_active')} />
      </Field>
    </Drawer>
  )
}
