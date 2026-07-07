/**
 * アプリ共通レイアウト
 *
 * 左サイドバー（ナビゲーション）＋メインコンテンツの2カラム構成。
 * ナビはホーム画面の2層構造（マスタ/運用）と対応したグループ＋ツリー罫線で表示する。
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import styles from './AppLayout.module.css'
import { OfflineBanner } from './OfflineBanner'

function NavItem({
  to,
  label,
  end = false,
}: {
  to: string
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
      }
    >
      {label}
    </NavLink>
  )
}

/** サブグループ（層ラベル＋ツリー罫線付きの子項目） */
function NavTree({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'master' | 'ops' | 'dest'
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'master'
      ? styles.toneMaster
      : tone === 'ops'
        ? styles.toneOps
        : styles.toneDest
  return (
    <div className={`${styles.subGroup} ${toneClass}`}>
      <div className={styles.subGroupLabel}>{label}</div>
      <div className={styles.treeChildren}>{children}</div>
    </div>
  )
}

export function AppLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          BOMOps
          <span className={styles.logoSub}>Dynamic BOM Platform</span>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navGroup}>ワークスペース</div>
          <NavItem to="/workspace" label="ホーム（関係マップ）" end />

          <NavTree label="マスタ（静的）" tone="master">
            <NavItem to="/workspace/product-models" label="製品モデル" />
            <NavItem to="/workspace/part-masters" label="部品マスタ" />
          </NavTree>

          <NavTree label="運用（動的）" tone="ops">
            <NavItem to="/workspace/sets" label="製品セット" />
            <NavItem to="/workspace/part-units" label="部品実物" />
          </NavTree>

          <NavTree label="導入先（準静的）" tone="dest">
            <NavItem to="/workspace/customers" label="顧客・拠点" />
          </NavTree>

          <NavItem to="/workspace/search" label="検索" />

          <div className={styles.navGroup}>ダッシュボード</div>
          <NavItem to="/dashboard" label="サマリー" />
        </nav>

        <button className={styles.logout} onClick={handleLogout}>
          ログアウト
        </button>
      </aside>

      <div className={styles.content}>
        <OfflineBanner />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
