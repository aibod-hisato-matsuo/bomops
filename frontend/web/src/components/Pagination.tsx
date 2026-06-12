/**
 * ページネーション（DRF PageNumberPagination 準拠、PAGE_SIZE=20）
 */

import styles from './Pagination.module.css'

const PAGE_SIZE = 20

interface PaginationProps {
  count: number | undefined
  page: number
  onPageChange: (page: number) => void
}

export function Pagination({ count, page, onPageChange }: PaginationProps) {
  if (count === undefined || count <= PAGE_SIZE) return null

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div className={styles.bar}>
      <span className={styles.info}>
        全{count}件 / {page}ページ目（全{totalPages}ページ）
      </span>
      <div className={styles.buttons}>
        <button
          className={styles.button}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          前へ
        </button>
        <button
          className={styles.button}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          次へ
        </button>
      </div>
    </div>
  )
}
