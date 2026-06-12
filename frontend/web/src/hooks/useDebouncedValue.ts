/**
 * 値の変更を遅延させるフック（検索入力のAPI連打防止用）
 */

import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
