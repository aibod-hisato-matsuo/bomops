/**
 * カスケード絞り込みのピルボタン行
 *
 * 「全て」＋ 値ごとの件数付きボタンを1行に表示する。
 * 部品マスタのカテゴリ行・製品モデルのファミリ/グレード/バリエーション行で共用。
 */

import styles from './CascadeRow.module.css'

export interface CascadeOption {
  value: string
  label: string
  count: number
}

export function CascadeRow({
  label,
  options,
  active,
  allCount,
  onChange,
}: {
  label: string
  options: CascadeOption[]
  active: string
  allCount: number | undefined
  onChange: (value: string) => void
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <button
        type="button"
        className={
          active === '' ? `${styles.pill} ${styles.pillActive}` : styles.pill
        }
        onClick={() => onChange('')}
      >
        全て
        {allCount !== undefined && (
          <span className={styles.count}>{allCount}</span>
        )}
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={
            active === o.value
              ? `${styles.pill} ${styles.pillActive}`
              : styles.pill
          }
          onClick={() => onChange(active === o.value ? '' : o.value)}
        >
          {o.label}
          <span className={styles.count}>{o.count}</span>
        </button>
      ))}
    </div>
  )
}
