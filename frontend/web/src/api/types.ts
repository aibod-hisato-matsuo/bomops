/**
 * APIモデル型エイリアス
 *
 * 自動生成スキーマ（schema.d.ts）から利用頻度の高い型を再エクスポートする。
 * モデル型を手書きしない（バックエンド変更時は npm run codegen で再生成）。
 */

import type { components } from './schema'

type Schemas = components['schemas']

export type PartCategory = Schemas['PartCategory']
export type PartMaster = Schemas['PartMaster']
export type PartMasterCategorySummary = Schemas['PartMasterCategorySummary']
export type PartUnit = Schemas['PartUnit']
export type ProductModel = Schemas['ProductModel']
export type ProductBOM = Schemas['ProductBOM']
export type Customer = Schemas['Customer']
export type CustomerSite = Schemas['CustomerSite']
export type SiteConfig = Schemas['SiteConfig']
export type BssSet = Schemas['BssSet']
export type BssSetComponent = Schemas['BssSetComponent']
export type BssSetConfig = Schemas['BssSetConfig']
export type BssSetComposition = Schemas['BssSetComposition']
export type EffectiveConfig = Schemas['EffectiveConfig']
export type MaintenanceEvent = Schemas['MaintenanceEvent']
export type DeployEvent = Schemas['DeployEvent']
export type EquipmentRef = Schemas['EquipmentRef']

export type DashboardSummary = Schemas['DashboardSummary']
export type DashboardStockCoverage = Schemas['DashboardStockCoverage']
export type LookupBySerial = Schemas['LookupBySerial']
export type PartUnitHistory = Schemas['PartUnitHistory']
export type PartUnitHistoryEntry = Schemas['PartUnitHistoryEntry']

export type PartUnitStatusEnum = Schemas['PartUnitStatusEnum']
export type BssSetStatusEnum = Schemas['BssSetStatusEnum']
export type LifecycleStatusEnum = Schemas['LifecycleStatusEnum']
export type EventTypeEnum = Schemas['EventTypeEnum']
export type StageEnum = Schemas['StageEnum']

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
