/**
 * ログイン画面
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from './auth-context'
import styles from './LoginPage.module.css'

const loginSchema = z.object({
  username: z.string().min(1, 'ユーザー名を入力してください'),
  password: z.string().min(1, 'パスワードを入力してください'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginForm) => {
    setServerError(null)
    try {
      await login(values.username, values.password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/workspace', { replace: true })
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setServerError('ユーザー名またはパスワードが正しくありません')
      } else {
        setServerError('ログインに失敗しました。接続を確認してください')
      }
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandBar} />
        <h1 className={styles.title}>BOMOps</h1>
        <p className={styles.subtitle}>Dynamic BOM Platform</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className={styles.label} htmlFor="username">
            ユーザー名
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            className={styles.input}
            {...register('username')}
          />
          {errors.username && (
            <p className={styles.error}>{errors.username.message}</p>
          )}

          <label className={styles.label} htmlFor="password">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={styles.input}
            {...register('password')}
          />
          {errors.password && (
            <p className={styles.error}>{errors.password.message}</p>
          )}

          {serverError && <p className={styles.error}>{serverError}</p>}

          <button
            type="submit"
            className={styles.submit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
