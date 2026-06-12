/**
 * BOMOps APIクライアント
 *
 * axios インスタンスに JWT の付与とリフレッシュを実装する。
 * - リクエスト時: localStorage のアクセストークンを Authorization ヘッダへ
 * - 401 受信時: リフレッシュトークンで再取得し、元リクエストを1回だけ再試行
 * - リフレッシュ失敗時: トークンを破棄して /login へ
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { networkStore } from '../lib/network-store'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

const ACCESS_TOKEN_KEY = 'bomops.access'
const REFRESH_TOKEN_KEY = 'bomops.refresh'

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccess()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  // 同時多発する401で多重リフレッシュしないよう単一Promiseに集約する
  refreshPromise ??= (async () => {
    const refresh = tokenStore.getRefresh()
    if (!refresh) throw new Error('no refresh token')
    const { data } = await axios.post<{ access: string; refresh?: string }>(
      `${API_BASE_URL}/auth/token/refresh/`,
      { refresh },
    )
    tokenStore.set(data.access, data.refresh)
    return data.access
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

apiClient.interceptors.response.use(
  (response) => {
    networkStore.reportSuccess()
    return response
  },
  async (error: AxiosError) => {
    // HTTPエラー応答はネットワーク到達済み。応答なしのみ切断として報告する
    if (error.response) {
      networkStore.reportSuccess()
    } else {
      networkStore.reportFailure()
    }

    const config = error.config as RetriableConfig | undefined
    const isAuthEndpoint = config?.url?.includes('/auth/token/')

    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !isAuthEndpoint
    ) {
      config._retried = true
      try {
        const access = await refreshAccessToken()
        config.headers.Authorization = `Bearer ${access}`
        return apiClient.request(config)
      } catch {
        tokenStore.clear()
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
