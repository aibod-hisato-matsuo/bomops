/**
 * parseApiErrors のユニットテスト
 */

import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { parseApiErrors } from './errors'

function makeAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed')
  error.response = {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  }
  return error
}

describe('parseApiErrors', () => {
  it('DRFフィールドエラーを fields に振り分ける', () => {
    const err = makeAxiosError(400, {
      serial_number: ['この シリアル番号 は既に存在します。'],
      part_master: ['この項目は必須です。'],
    })
    const result = parseApiErrors(err)
    expect(result.message).toBeNull()
    expect(result.fields.serial_number).toBe('この シリアル番号 は既に存在します。')
    expect(result.fields.part_master).toBe('この項目は必須です。')
  })

  it('detail を message に振り分ける（409保護削除など）', () => {
    const err = makeAxiosError(409, {
      detail: '他のレコードから参照されているため削除できません',
    })
    const result = parseApiErrors(err)
    expect(result.message).toBe('他のレコードから参照されているため削除できません')
    expect(result.fields).toEqual({})
  })

  it('non_field_errors も message として扱う', () => {
    const err = makeAxiosError(400, { non_field_errors: ['不正な組み合わせです'] })
    expect(parseApiErrors(err).message).toBe('不正な組み合わせです')
  })

  it('レスポンスのない通信エラーは接続確認メッセージを返す', () => {
    const err = new AxiosError('Network Error')
    const result = parseApiErrors(err)
    expect(result.message).toContain('通信に失敗しました')
  })

  it('axios以外の例外は汎用メッセージを返す', () => {
    const result = parseApiErrors(new Error('boom'))
    expect(result.message).toContain('予期しないエラー')
  })
})
