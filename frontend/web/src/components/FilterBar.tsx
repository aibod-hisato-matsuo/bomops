/**
 * 一覧画面のフィルタバー
 *
 * テキスト検索・セレクトをまとめて配置するコンテナと入力部品。
 */

import type { ReactNode } from 'react'

import styles from './FilterBar.module.css'

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className={styles.bar}>{children}</div>
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <input
      type="search"
      className={styles.search}
      value={value}
      placeholder={placeholder ?? 'キーワード検索'}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

interface SelectFilterProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  allLabel: string
}

export function SelectFilter({
  value,
  onChange,
  options,
  allLabel,
}: SelectFilterProps) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
