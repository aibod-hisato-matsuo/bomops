/**
 * ネットワーク状態フック
 */

import { useSyncExternalStore } from 'react'

import { networkStore, type NetworkStatus } from '../lib/network-store'

export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(networkStore.subscribe, networkStore.getStatus)
}
