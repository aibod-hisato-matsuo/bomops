/**
 * 一覧画面のクエリパラメータをURLと同期するフック
 *
 * フィルタ・検索・ページ番号を URLSearchParams に保持し、
 * リロード・URL共有しても同じ一覧状態を再現できるようにする。
 */

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { ListParams } from '../api/hooks'

export function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = useMemo(() => {
    const obj: ListParams = {}
    searchParams.forEach((value, key) => {
      if (value !== '') obj[key] = value
    })
    return obj
  }, [searchParams])

  const page = Number(searchParams.get('page') ?? '1')

  /** フィルタ変更（ページは1に戻す） */
  const setFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value === '') {
          next.delete(key)
        } else {
          next.set(key, value)
        }
        next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  const setPage = useCallback(
    (nextPage: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (nextPage <= 1) {
          next.delete('page')
        } else {
          next.set('page', String(nextPage))
        }
        return next
      })
    },
    [setSearchParams],
  )

  /** 複数フィルタの一括変更（ページは1に戻す・履歴は1件） */
  const setFilters = useCallback(
    (entries: Record<string, string>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(entries)) {
          if (value === '') {
            next.delete(key)
          } else {
            next.set(key, value)
          }
        }
        next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  const getFilter = useCallback(
    (key: string) => searchParams.get(key) ?? '',
    [searchParams],
  )

  return { params, page, setPage, setFilter, setFilters, getFilter }
}
