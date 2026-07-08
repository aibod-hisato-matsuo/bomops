/**
 * トースト通知コンテキスト定義と useToast フック
 */

import { createContext, useContext } from 'react'

/** トーストに添えるアクション（「次の一手」導線用） */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastApi {
  success: (message: string, action?: ToastAction) => void
  error: (message: string, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
