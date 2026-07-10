/**
 * フォーム共通ユーティリティ
 *
 * - cleanPayload: 送信ペイロードの整形（空文字/未定義の除去・文字列トリム）
 * - dtLocalToIso / isoToDtLocal: <input type="datetime-local"> と ISO8601 の往復変換
 * - applyServerErrors: DRF のフィールドエラーを react-hook-form へ反映
 */

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

/**
 * 送信用ペイロードを整形する。
 * - 文字列はトリムし、空文字は除去（更新は PATCH のため未送信＝変更なし）
 * - undefined / null のキーは除去
 * - false / 0 / 配列などの有意な値は保持する
 */
export function cleanPayload<T extends Record<string, unknown>>(
  values: T,
): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '') continue
      out[key] = trimmed
    } else {
      out[key] = value
    }
  }
  return out as Partial<T>
}

/**
 * datetime-local の入力値（ローカル時刻）を ISO8601（UTC）へ変換する。
 * 空・不正値は undefined を返す。
 */
export function dtLocalToIso(local?: string | null): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

/**
 * ISO8601 の値を datetime-local 入力値（ローカル時刻 "YYYY-MM-DDTHH:mm"）へ変換する。
 * 空・不正値は空文字を返す。
 */
export function isoToDtLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/**
 * parseApiErrors が返したフィールドエラー（フィールド名→メッセージ）を
 * react-hook-form の setError に流し込む。
 */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fields: Record<string, string>,
): void {
  for (const [name, message] of Object.entries(fields)) {
    setError(name as Path<T>, { type: 'server', message })
  }
}
