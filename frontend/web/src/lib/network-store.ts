/**
 * ネットワーク状態ストア（3層検知）
 *
 * network-resilience 方針に基づき、以下の3経路で接続状態を判定する:
 *  1. ブラウザの online/offline イベント（navigator.onLine）
 *  2. API クライアントからの成功/失敗レポート（連続 FAILURE_THRESHOLD 回の
 *     「応答なし」で offline 判定。HTTP エラー応答は到達済みなので success 扱い）
 *  3. ヘルスチェック（認証不要・DBアクセスなしの HEAD /health/ を、復帰イベント時と
 *     一定間隔でポーリングして到達性を確認）
 *
 * React とは useSyncExternalStore（subscribe / getStatus）で接続する。
 * getStatus はプリミティブな status をそのまま返すため、値が変わったときのみ
 * 再レンダリングされる（キャッシュのための safety は React 側が担保）。
 */

export type NetworkStatus = 'online' | 'offline'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const HEALTH_URL = `${API_BASE_URL}/health/`

// 連続でこの回数「応答なし」が続いたら offline とみなす
const FAILURE_THRESHOLD = 2
// offline 中の復帰検知および定常監視のポーリング間隔
const HEALTH_POLL_MS = 5 * 60 * 1000

type Listener = () => void

let status: NetworkStatus = 'online'
let consecutiveFailures = 0
let started = false
let pollTimer: ReturnType<typeof setInterval> | null = null

const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setStatus(next: NetworkStatus): void {
  if (status === next) return
  status = next
  emit()
}

/**
 * ヘルスチェック（第3層）。
 * - 応答が返れば（2xx でなくても）サーバ到達済み → online
 * - fetch 自体が throw（応答なし）→ offline
 */
async function healthCheck(): Promise<void> {
  try {
    const res = await fetch(HEALTH_URL, { method: 'HEAD', cache: 'no-store' })
    if (res.ok) consecutiveFailures = 0
    setStatus('online')
  } catch {
    setStatus('offline')
  }
}

/** API クライアントが応答を受け取った（HTTPエラー含む）＝到達済み。 */
function reportSuccess(): void {
  consecutiveFailures = 0
  setStatus('online')
}

/** API クライアントが応答なしで失敗した＝切断の可能性。閾値超過で offline。 */
function reportFailure(): void {
  consecutiveFailures += 1
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    setStatus('offline')
  }
}

function handleBrowserOnline(): void {
  // ブラウザは online と言っているが実到達性はヘルスチェックで確認する
  void healthCheck()
}

function handleBrowserOffline(): void {
  setStatus('offline')
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getStatus(): NetworkStatus {
  return status
}

/** アプリ起動時に1回だけ呼ぶ。監視を開始する。 */
function start(): void {
  if (started) return
  started = true

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    status = 'offline'
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleBrowserOnline)
    window.addEventListener('offline', handleBrowserOffline)
    pollTimer = setInterval(() => {
      void healthCheck()
    }, HEALTH_POLL_MS)
  }
}

/** 監視を停止する（主にテスト用）。 */
function stop(): void {
  if (!started) return
  started = false
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleBrowserOnline)
    window.removeEventListener('offline', handleBrowserOffline)
  }
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export const networkStore = {
  start,
  stop,
  subscribe,
  getStatus,
  isOffline: () => status === 'offline',
  reportSuccess,
  reportFailure,
}
