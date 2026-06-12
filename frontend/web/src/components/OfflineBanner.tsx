/**
 * オフラインバナー（非ブロッキング）
 *
 * 切断中は警告バナーを常時表示し、復帰時は3秒間だけ復帰通知を出す。
 * 操作はブロックしない（閲覧は継続できる）。
 */

import { useEffect, useRef, useState } from 'react'

import { useNetworkStatus } from '../hooks/useNetworkStatus'
import styles from './OfflineBanner.module.css'

const RECOVERED_DISPLAY_MS = 3000

export function OfflineBanner() {
  const status = useNetworkStatus()
  const [showRecovered, setShowRecovered] = useState(false)
  const wasOffline = useRef(false)

  useEffect(() => {
    if (status === 'offline') {
      wasOffline.current = true
      return
    }
    if (status === 'online' && wasOffline.current) {
      wasOffline.current = false
      const show = setTimeout(() => setShowRecovered(true), 0)
      const hide = setTimeout(() => setShowRecovered(false), RECOVERED_DISPLAY_MS)
      return () => {
        clearTimeout(show)
        clearTimeout(hide)
      }
    }
  }, [status])

  if (status === 'offline') {
    return (
      <div role="status" aria-live="polite" className={`${styles.banner} ${styles.offline}`}>
        オフラインです。表示中のデータは最後に取得した内容です。接続復帰後に自動で更新されます
      </div>
    )
  }
  if (showRecovered) {
    return (
      <div role="status" aria-live="polite" className={`${styles.banner} ${styles.recovered}`}>
        オンラインに復帰しました
      </div>
    )
  }
  return null
}
