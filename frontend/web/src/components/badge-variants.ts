/**
 * ステータス値 → バッジ色のマッピング
 */

import type { BadgeVariant } from './Badge'

/** PartUnit.status → バッジ表現 */
export const partUnitStatusVariant: Record<string, BadgeVariant> = {
  IN_STOCK: 'pale',
  ASSIGNED: 'sky',
  BROKEN: 'danger',
  SCRAPPED: 'gray',
}

/** BssSet.status → バッジ表現 */
export const bssSetStatusVariant: Record<string, BadgeVariant> = {
  ASSEMBLED: 'pale',
  INSTALLED: 'sky',
  REPAIR: 'danger',
  RECOVERED: 'gray',
  SCRAPPED: 'gray',
}

/** CustomerSite.lifecycle_status → バッジ表現 */
export const lifecycleStatusVariant: Record<string, BadgeVariant> = {
  PREPARING: 'pale',
  ACTIVE: 'sky',
  WITHDRAWN: 'gray',
  BASE: 'navy',
  LOANED: 'pale',
}
