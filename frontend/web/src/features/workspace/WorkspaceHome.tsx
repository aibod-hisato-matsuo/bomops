/**
 * Workspace ホーム（P1プレースホルダ）
 *
 * P2以降で各リソースの一覧・編集画面に置き換わる入口ページ。
 */

import { Link } from 'react-router-dom'

import { PageHeader } from '../../components/PageHeader'
import styles from './WorkspaceHome.module.css'

const menuItems = [
  { to: '/workspace/part-masters', title: '部品マスタ', desc: '型番レベルの部品仕様を管理' },
  { to: '/workspace/part-units', title: '部品実物', desc: 'シリアル番号付き実物の在庫・状態' },
  { to: '/workspace/product-models', title: '製品モデル', desc: '製品型番とBOM構成表' },
  { to: '/workspace/customers', title: '顧客・拠点', desc: '設置先顧客と拠点・拠点設定' },
  { to: '/workspace/sets', title: 'BSSセット', desc: '完成機の構成・設定・イベント履歴' },
  { to: '/workspace/search', title: '検索', desc: 'シリアル逆引き・横断検索・使用履歴' },
]

export function WorkspaceHome() {
  return (
    <div>
      <PageHeader
        title="ワークスペース"
        description="レコードの作成・編集・検索を行います"
      />
      <div className={styles.grid}>
        {menuItems.map((item) => (
          <Link key={item.to} to={item.to} className={styles.card}>
            <h2 className={styles.cardTitle}>{item.title}</h2>
            <p className={styles.cardDesc}>{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
