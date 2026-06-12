/**
 * DRFエラーレスポンスの解析
 *
 * 400系のフィールドバリデーションエラーをフォームに、
 * detail メッセージを通知に振り分けられる形へ変換する。
 */

import { isAxiosError } from 'axios'

export interface ApiErrors {
  /** 全体メッセージ（detail / non_field_errors / 通信エラー） */
  message: string | null
  /** フィールド名 → エラーメッセージ */
  fields: Record<string, string>
}

export function parseApiErrors(err: unknown): ApiErrors {
  if (!isAxiosError(err)) {
    return { message: '予期しないエラーが発生しました', fields: {} }
  }
  if (!err.response) {
    return { message: '通信に失敗しました。接続を確認してください', fields: {} }
  }

  const data = err.response.data as Record<string, unknown> | undefined
  if (!data || typeof data !== 'object') {
    return { message: `エラーが発生しました (${err.response.status})`, fields: {} }
  }

  const fields: Record<string, string> = {}
  let message: string | null = null

  for (const [key, value] of Object.entries(data)) {
    const text = Array.isArray(value) ? value.join(' ') : String(value)
    if (key === 'detail' || key === 'non_field_errors') {
      message = text
    } else {
      fields[key] = text
    }
  }

  if (message === null && Object.keys(fields).length === 0) {
    message = `エラーが発生しました (${err.response.status})`
  }
  return { message, fields }
}
