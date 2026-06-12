/**
 * アプリ共通レイアウト
 *
 * 左サイドバー（ナビゲーション）＋メインコンテンツの2カラム構成。
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import styles from './AppLayout.module.css'
import { OfflineBanner } from './OfflineBanner'

const workspaceNav = [
  { to: '/workspace', label: 'ホーム', end: true },
  { to: '/workspace/part-masters', label: '部品マスタ' },
  { to: '/workspace/part-units', label: '部品実物' },
  { to: '/workspace/product-models', label: '製品モデル' },
  { to: '/workspace/customers', label: '顧客・拠点' },
  { to: '/workspace/sets', label: 'BSSセット' },
  { to: '/workspace/search', label: '検索' },
]

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
          {workspaceNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
              }
            >
              {item.label}
            </NavLink>
          ))}

          <div className={styles.navGroup}>ダッシュボード</div>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
          >
            サマリー
          </NavLink>
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
