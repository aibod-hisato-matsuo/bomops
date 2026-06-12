/**
 * 詳細画面用の項目リスト（ラベル＋値の表組み）
 */

import type { ReactNode } from 'react'

import styles from './DescList.module.css'

interface DescListProps {
  items: { label: string; value: ReactNode }[]
}

export function DescList({ items }: DescListProps) {
  return (
    <dl className={styles.list}>
      {items.map((item) => (
        <div key={item.label} className={styles.row}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value}>{item.value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 詳細画面のセクション枠 */
export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}
