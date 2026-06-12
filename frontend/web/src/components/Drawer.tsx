/**
 * スライドオーバー（右側ドロワー）
 *
 * 一覧画面のコンテキストを保ったまま作成・編集フォームを表示する。
 */

import type { ReactNode } from 'react'

import styles from './Drawer.module.css'

interface DrawerProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Drawer({ title, onClose, children, footer }: DrawerProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.close} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}
