/**
 * デバウンス付き検索入力とURLフィルタの同期フック
 */

import { useEffect, useState } from 'react'

import { useDebouncedValue } from '../../../hooks/useDebouncedValue'

export function useSearchFilter(
  getFilter: (key: string) => string,
  setFilter: (key: string, value: string) => void,
  key = 'search',
) {
  const [text, setText] = useState(() => getFilter(key))
  const debounced = useDebouncedValue(text)

  useEffect(() => {
    if (debounced !== getFilter(key)) {
      setFilter(key, debounced)
    }
  }, [debounced, getFilter, setFilter, key])

  return { text, setText }
}
