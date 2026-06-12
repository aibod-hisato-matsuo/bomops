/**
 * トースト通知プロバイダ
 *
 * 操作の成功・失敗を画面右下に一時表示する。
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'

import { ToastContext } from './toast-context'
import styles from './ToastProvider.module.css'

interface ToastItem {
  id: number
  type: 'success' | 'error'
  message: string
}

const DISMISS_MS = 3500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const push = useCallback((type: ToastItem['type'], message: string) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, DISMISS_MS)
  }, [])

  const api = {
    success: useCallback((m: string) => push('success', m), [push]),
    error: useCallback((m: string) => push('error', m), [push]),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.container}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
