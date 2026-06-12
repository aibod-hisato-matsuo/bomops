/**
 * BOMOps アプリケーションルート
 *
 * プロバイダ（認証・サーバ状態）とルーティングを構成する。
 */

import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { ToastProvider } from './components/toast/ToastProvider'
import { useToast } from './components/toast/toast-context'
import { networkStore } from './lib/network-store'
import { CustomersPage } from './features/workspace/customers/CustomersPage'
import { SiteConfigPage } from './features/workspace/customers/SiteConfigPage'
import { PartUnitHistoryPage } from './features/workspace/search/PartUnitHistoryPage'
import { SearchPage } from './features/workspace/search/SearchPage'
import { PartMasterListPage } from './features/workspace/parts/PartMasterListPage'
import { PartUnitListPage } from './features/workspace/parts/PartUnitListPage'
import { ProductModelDetailPage } from './features/workspace/products/ProductModelDetailPage'
import { ProductModelListPage } from './features/workspace/products/ProductModelListPage'
import { BssSetDetailPage } from './features/workspace/sets/BssSetDetailPage'
import { BssSetListPage } from './features/workspace/sets/BssSetListPage'
import { WorkspaceHome } from './features/workspace/WorkspaceHome'

// チャートライブラリ(recharts)が大きいためダッシュボードは遅延ロードする
const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
)

// 読み取りエラーのトースト連打を防ぐ最小間隔
const ERROR_TOAST_THROTTLE_MS = 5000
let lastErrorToastAt = 0

/** QueryClient を Toast と接続して生成するプロバイダ */
function QueryProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
        queryCache: new QueryCache({
          onError: () => {
            // オフライン中はバナーが状況を説明するためトーストは出さない
            if (networkStore.isOffline()) return
            const now = Date.now()
            if (now - lastErrorToastAt < ERROR_TOAST_THROTTLE_MS) return
            lastErrorToastAt = now
            toast.error('最新情報を取得できません。接続を確認してください')
          },
        }),
      }),
  )
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default function App() {
  return (
    <ToastProvider>
      <QueryProvider>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/workspace" replace />} />
                <Route path="/workspace" element={<WorkspaceHome />} />
                <Route
                  path="/workspace/part-masters"
                  element={<PartMasterListPage />}
                />
                <Route
                  path="/workspace/part-units"
                  element={<PartUnitListPage />}
                />
                <Route
                  path="/workspace/part-units/:id/history"
                  element={<PartUnitHistoryPage />}
                />
                <Route
                  path="/workspace/product-models"
                  element={<ProductModelListPage />}
                />
                <Route
                  path="/workspace/product-models/:id"
                  element={<ProductModelDetailPage />}
                />
                <Route
                  path="/workspace/customers"
                  element={<CustomersPage />}
                />
                <Route
                  path="/workspace/sites/:id/config"
                  element={<SiteConfigPage />}
                />
                <Route path="/workspace/sets" element={<BssSetListPage />} />
                <Route
                  path="/workspace/sets/:id"
                  element={<BssSetDetailPage />}
                />
                <Route path="/workspace/search" element={<SearchPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <Suspense fallback={<p>読み込み中...</p>}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryProvider>
    </ToastProvider>
  )
}
