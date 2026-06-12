/**
 * APIクエリフック
 *
 * TanStack Query で一覧（ページネーション付き）と詳細を取得する汎用フック。
 * 各画面はこのフックに リソースパス + クエリパラメータ を渡すだけにする。
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { apiClient } from './client'
import type { Paginated } from './types'

export type ListParams = Record<string, string | number | boolean | undefined>

/** 一覧取得（DRF PageNumberPagination 準拠） */
export function useList<T>(path: string, params: ListParams = {}) {
  return useQuery({
    queryKey: ['list', path, params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<T>>(path, { params })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

/** 詳細取得 */
export function useDetail<T>(path: string, id: string | number | undefined) {
  return useQuery({
    queryKey: ['detail', path, id],
    queryFn: async () => {
      const { data } = await apiClient.get<T>(`${path}${id}/`)
      return data
    },
    enabled: id !== undefined,
  })
}

/** カスタムアクション等の単発GET */
export function useGet<T>(
  path: string | null,
  options: { refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: ['get', path],
    queryFn: async () => {
      const { data } = await apiClient.get<T>(path as string)
      return data
    },
    enabled: path !== null,
    ...options,
  })
}

/**
 * 書き込み系フック
 *
 * 成功時は全クエリを無効化する（リソース間の派生表示 — 構成ビュー・
 * 件数カラム等 — が多いため、対象を絞らず確実に再取得させる）。
 */

export function useCreate<T>(path: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: unknown) => {
      const { data } = await apiClient.post<T>(path, payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useUpdate<T>(path: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string | number
      payload: unknown
    }) => {
      const { data } = await apiClient.patch<T>(`${path}${id}/`, payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useDelete(path: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string | number) => {
      await apiClient.delete(`${path}${id}/`)
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
