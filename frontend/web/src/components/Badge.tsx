/**
 * ステータスバッジ
 *
 * カラーポリシー: アクセントは原則スカイブルー系。異常系のみ赤。
 * ステータス値→色のマッピングは badge-variants.ts を参照。
 */

import type { ReactNode } from 'react'

import styles from './Badge.module.css'

export type BadgeVariant = 'sky' | 'pale' | 'navy' | 'gray' | 'danger'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
}

export function Badge({ variant = 'pale', children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>
}
