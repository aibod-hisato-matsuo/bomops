/**
 * 認証プロバイダ
 *
 * JWT トークンの取得（ログイン）・破棄（ログアウト）と認証状態を提供する。
 */

import { useCallback, useState, type ReactNode } from 'react'

import { apiClient, tokenStore } from '../api/client'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => tokenStore.getAccess() !== null,
  )

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await apiClient.post<{ access: string; refresh: string }>(
      '/auth/token/',
      { username, password },
    )
    tokenStore.set(data.access, data.refresh)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setIsAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
