/**
 * 部品使用履歴（W-10）
 *
 * 購入・搭載/取外し・保守の履歴を1本のタイムラインで表示する。
 */

import { Link, useParams } from 'react-router-dom'

import { useGet } from '../../../api/hooks'
import type { PartUnitHistory, PartUnitHistoryEntry } from '../../../api/types'
import { Badge, type BadgeVariant } from '../../../components/Badge'
import { partUnitStatusVariant } from '../../../components/badge-variants'
import { PageHeader } from '../../../components/PageHeader'
import styles from './PartUnitHistoryPage.module.css'

const kindLabel: Record<string, string> = {
  PURCHASED: '購入',
  MOUNTED: '搭載',
  UNMOUNTED: '取外し',
  MAINTENANCE: '保守',
}

const kindVariant: Record<string, BadgeVariant> = {
  PURCHASED: 'gray',
  MOUNTED: 'sky',
  UNMOUNTED: 'pale',
  MAINTENANCE: 'danger',
}

function entryDescription(entry: PartUnitHistoryEntry): string {
  switch (entry.kind) {
    case 'PURCHASED':
      return entry.purchase_order_no
        ? `購入（発注番号: ${entry.purchase_order_no}）`
        : '購入'
    case 'MOUNTED':
      return `${entry.set_code} に搭載${entry.role ? `（${entry.role}）` : ''}`
    case 'UNMOUNTED':
      return `${entry.set_code} から取外し${entry.role ? `（${entry.role}）` : ''}`
    case 'MAINTENANCE':
      return `${entry.event_type_display}（${entry.set_code}）`
    default:
      return entry.kind
  }
}

export function PartUnitHistoryPage() {
  const { id } = useParams()
  const { data, isPending } = useGet<PartUnitHistory>(
    id ? `/part-units/${id}/history/` : null,
  )

  const unit = data?.part_unit as
    | {
        serial_number: string
        part_code: string
        part_name: string
        status: string
        status_display: string
      }
    | undefined

  return (
    <div>
      <PageHeader
        title={unit ? `使用履歴: ${unit.serial_number}` : '使用履歴'}
        description={unit ? `${unit.part_code}: ${unit.part_name}` : undefined}
        actions={<Link to="/workspace/search">検索へ戻る</Link>}
      />

      {unit && (
        <p className={styles.statusLine}>
          現在のステータス:{' '}
          <Badge variant={partUnitStatusVariant[unit.status] ?? 'pale'}>
            {unit.status_display}
          </Badge>
        </p>
      )}

      {isPending && <p>読み込み中...</p>}

      {data && data.timeline.length === 0 && (
        <p className={styles.empty}>履歴がありません</p>
      )}

      {data && data.timeline.length > 0 && (
        <ol className={styles.timeline}>
          {data.timeline.map((entry, index) => (
            <li key={index} className={styles.item}>
              <div className={styles.marker} data-kind={entry.kind} />
              <div className={styles.content}>
                <div className={styles.row}>
                  <Badge variant={kindVariant[entry.kind] ?? 'pale'}>
                    {kindLabel[entry.kind] ?? entry.kind}
                  </Badge>
                  <span className={styles.date}>
                    {entry.occurred_at.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <p className={styles.description}>{entryDescription(entry)}</p>
                {entry.note && <p className={styles.note}>{entry.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
