/**
 * URL の ?new=1 を検知して作成ドロワーを開くフック
 *
 * 作成ランチャー（ワークスペースホーム）からのディープリンクで、
 * 遷移先ページの新規作成ドロワーを自動で開くために使う。
 * 一度開いたら ?new パラメータを消して、再表示のループを防ぐ。
 */

import { useEffect } from 'react'

import { useListParams } from './useListParams'

export function useNewParam(onNew: () => void) {
  const { getFilter, setFilter } = useListParams()
  const isNew = getFilter('new') === '1'

  useEffect(() => {
    // isNew が真になったら1回だけ開き、パラメータを消す（消すと isNew は偽に戻る）
    if (!isNew) return
    onNew()
    setFilter('new', '')
  }, [isNew, onNew, setFilter])
}
