/**
 * 拠点設定エディタ（W-6）
 *
 * secret系フィールドの取り扱い:
 * - 現在値はAPIからマスク済（****xxxx）でしか取得できない（仕様）
 * - 入力欄は常に空で、マスク値はプレースホルダとして表示する
 * - ユーザーが入力したフィールドだけを送信する（未入力=変更しない）
 */

import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'

import { parseApiErrors } from '../../../api/errors'
import { useCreate, useDetail, useList, useUpdate } from '../../../api/hooks'
import type { CustomerSite, SiteConfig } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Field, TextArea, TextInput } from '../../../components/form/Field'
import { PageHeader } from '../../../components/PageHeader'
import { Section } from '../../../components/DescList'
import { useToast } from '../../../components/toast/toast-context'
import { applyServerErrors } from '../../../lib/form-utils'
import styles from './SiteConfigPage.module.css'

interface FormValues {
  loyverse_account: string
  loyverse_store_id: string
  loyverse_token: string
  square_account: string
  squ_device_id: string
  squ_location_id: string
  squ_token: string
  paypay_secret: string
  baiten_cloud_key: string
  google_secret: string
  slack_bot_token: string
  config_toml: string
  baiten_env: string
}

type SecretField =
  | 'loyverse_token'
  | 'squ_token'
  | 'paypay_secret'
  | 'baiten_cloud_key'
  | 'google_secret'
  | 'slack_bot_token'

export function SiteConfigPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data: site } = useDetail<CustomerSite>('/customer-sites/', id)
  const configs = useList<SiteConfig>('/site-configs/', { customer_site: id })
  const config = configs.data?.results[0] ?? null

  const create = useCreate<SiteConfig>('/site-configs/')
  const update = useUpdate<SiteConfig>('/site-configs/')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    values: {
      loyverse_account: config?.loyverse_account ?? '',
      loyverse_store_id: config?.loyverse_store_id ?? '',
      loyverse_token: '',
      square_account: config?.square_account ?? '',
      squ_device_id: config?.squ_device_id ?? '',
      squ_location_id: config?.squ_location_id ?? '',
      squ_token: '',
      paypay_secret: '',
      baiten_cloud_key: '',
      google_secret: '',
      slack_bot_token: '',
      config_toml: config?.config_toml ?? '',
      baiten_env: config?.baiten_env ?? '',
    },
  })

  const secretPlaceholder = (field: SecretField) => {
    const masked = config?.[field]
    return masked ? `設定済 (${masked}) — 変更する場合のみ入力` : '未設定'
  }

  const onSubmit = async (values: FormValues) => {
    // 変更されたフィールドのみ送信する（secret の意図しない上書きを防ぐ）
    const payload: Record<string, unknown> = {}
    for (const [key, dirty] of Object.entries(dirtyFields)) {
      if (!dirty) continue
      const value = values[key as keyof FormValues]
      payload[key] = value === '' ? null : value
    }

    try {
      if (config) {
        if (Object.keys(payload).length === 0) {
          toast.success('変更はありません')
          return
        }
        await update.mutateAsync({ id: config.id, payload })
        toast.success('拠点設定を更新しました')
      } else {
        await create.mutateAsync({ ...payload, customer_site: Number(id) })
        toast.success('拠点設定を作成しました')
      }
    } catch (err) {
      const { message, fields } = parseApiErrors(err)
      applyServerErrors(setError, fields)
      if (message) toast.error(message)
    }
  }

  return (
    <div>
      <PageHeader
        title={site ? `拠点設定: ${site.name}` : '拠点設定'}
        description={site ? `${site.customer_name} / secret系は暗号化保存されます` : undefined}
        actions={<Link to="/workspace/customers?tab=sites">拠点一覧へ戻る</Link>}
      />

      {configs.isPending ? (
        <p>読み込み中...</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className={styles.columns}>
            <Section title="Loyverse (POS)">
              <div className={styles.card}>
                <Field label="アカウント" error={errors.loyverse_account?.message}>
                  <TextInput {...register('loyverse_account')} />
                </Field>
                <Field label="店舗ID" error={errors.loyverse_store_id?.message}>
                  <TextInput {...register('loyverse_store_id')} />
                </Field>
                <Field label="トークン" error={errors.loyverse_token?.message}>
                  <TextInput
                    type="password"
                    autoComplete="off"
                    placeholder={secretPlaceholder('loyverse_token')}
                    {...register('loyverse_token')}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Square (決済)">
              <div className={styles.card}>
                <Field label="アカウント" error={errors.square_account?.message}>
                  <TextInput {...register('square_account')} />
                </Field>
                <Field label="デバイスID" error={errors.squ_device_id?.message}>
                  <TextInput {...register('squ_device_id')} />
                </Field>
                <Field label="ロケーションID" error={errors.squ_location_id?.message}>
                  <TextInput {...register('squ_location_id')} />
                </Field>
                <Field label="トークン" error={errors.squ_token?.message}>
                  <TextInput
                    type="password"
                    autoComplete="off"
                    placeholder={secretPlaceholder('squ_token')}
                    {...register('squ_token')}
                  />
                </Field>
              </div>
            </Section>

            <Section title="その他クレデンシャル">
              <div className={styles.card}>
                <Field label="PayPayシークレット" error={errors.paypay_secret?.message}>
                  <TextInput
                    type="password"
                    autoComplete="off"
                    placeholder={secretPlaceholder('paypay_secret')}
                    {...register('paypay_secret')}
                  />
                </Field>
                <Field label="BAITENクラウドキー" error={errors.baiten_cloud_key?.message}>
                  <TextInput
                    type="password"
                    autoComplete="off"
                    placeholder={secretPlaceholder('baiten_cloud_key')}
                    {...register('baiten_cloud_key')}
                  />
                </Field>
                <Field label="Googleシークレット" error={errors.google_secret?.message}>
                  <TextInput
                    type="password"
                    autoComplete="off"
                    placeholder={secretPlaceholder('google_secret')}
                    {...register('google_secret')}
                  />
                </Field>
                <Field label="Slack Botトークン" error={errors.slack_bot_token?.message}>
                  <TextInput
                    type="password"
                    autoComplete="off"
                    placeholder={secretPlaceholder('slack_bot_token')}
                    {...register('slack_bot_token')}
                  />
                </Field>
              </div>
            </Section>

            <Section title="設定ファイル">
              <div className={styles.card}>
                <Field label="config.toml" error={errors.config_toml?.message}>
                  <TextArea rows={8} {...register('config_toml')} />
                </Field>
                <Field label="baiten.env" error={errors.baiten_env?.message}>
                  <TextArea rows={8} {...register('baiten_env')} />
                </Field>
              </div>
            </Section>
          </div>

          <div className={styles.actions}>
            <Button type="submit" disabled={isSubmitting}>
              {config ? '更新' : '作成'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
