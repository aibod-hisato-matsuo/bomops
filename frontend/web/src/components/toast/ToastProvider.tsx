/**
 * トースト通知プロバイダ
 *
 * 操作の成功・失敗を画面右下に一時表示する。
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'

import { ToastContext, type ToastAction } from './toast-context'
import styles from './ToastProvider.module.css'

interface ToastItem {
  id: number
  type: 'success' | 'error'
  message: string
  action?: ToastAction
}

const DISMISS_MS = 3500
// アクション付きは「次の一手」を押す猶予を長めに取る
const DISMISS_ACTION_MS = 8000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastItem['type'], message: string, action?: ToastAction) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, type, message, action }])
      setTimeout(
        () => dismiss(id),
        action ? DISMISS_ACTION_MS : DISMISS_MS,
      )
    },
    [dismiss],
  )

  const api = {
    success: useCallback(
      (m: string, a?: ToastAction) => push('success', m, a),
      [push],
    ),
    error: useCallback(
      (m: string, a?: ToastAction) => push('error', m, a),
      [push],
    ),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.container}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
