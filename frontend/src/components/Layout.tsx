import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BrandMark } from './BrandMark'
import { ThemeToggle } from './ThemeToggle'

function Icon({ d, label }: { d: string; label: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>{label}</title>
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const I = {
  dash: 'M4 5h6v6H4V5zm10 0h6v4h-6V5zM4 13h6v6H4v-6zm10 2h6v4h-6v-4z',
  circuit: 'M12 3a3 3 0 013 3v1h2a3 3 0 010 6h-2v2h2a3 3 0 010 6h-2v1a3 3 0 11-6 0v-1H7a3 3 0 010-6h2v-2H7a3 3 0 010-6h2V6a3 3 0 013-3z',
  alerts: 'M12 4l8 14H4L12 4zm0 6v3m0 3h.01',
  logs: 'M7 5h10M7 9h10M7 13h6M5 3h14a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2V4a1 1 0 011-1z',
  admin: 'M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z',
  login: 'M10 17l5-5-5-5M15 12H3M15 5h4a2 2 0 012 2v10a2 2 0 01-2 2h-4',
  wait: 'M12 6v6l4 2M12 3a9 9 0 110 18 9 9 0 010-18z',
}

export function Layout() {
  const { user, logout } = useAuth()
  const approved = Boolean(user && (user.is_admin || user.is_approved))
  const isAdmin = Boolean(user?.is_admin)
  const home = !user ? '/' : approved ? '/dashboard' : '/waiting'

  return (
    <div className="shell">
      <aside className="rail" aria-label="Primary">
        <Link to={home} className="rail-brand" title="THRUM">
          <BrandMark size={26} />
          <span className="sr-only">THRUM</span>
        </Link>
        <nav className="rail-nav">
          {user ? (
            approved ? (
              <>
                <NavLink to="/dashboard" title="Dashboard" aria-label="Dashboard" end>
                  <Icon d={I.dash} label="Dashboard" />
                  <span className="rail-label">Pulse</span>
                </NavLink>
                <NavLink to="/circuits" title="Circuits" aria-label="Circuits">
                  <Icon d={I.circuit} label="Circuits" />
                  <span className="rail-label">Circuits</span>
                </NavLink>
                <NavLink to="/alerts" title="Alerts" aria-label="Alerts">
                  <Icon d={I.alerts} label="Alerts" />
                  <span className="rail-label">Alerts</span>
                </NavLink>
                <NavLink to="/logs" title="Audit log" aria-label="Audit log">
                  <Icon d={I.logs} label="Logs" />
                  <span className="rail-label">Audit</span>
                </NavLink>
                {isAdmin ? (
                  <NavLink to="/admin" title="Admin" aria-label="Admin">
                    <Icon d={I.admin} label="Admin" />
                    <span className="rail-label">Admin</span>
                  </NavLink>
                ) : null}
              </>
            ) : (
              <NavLink to="/waiting" title="Waiting" aria-label="Waiting for approval">
                <Icon d={I.wait} label="Waiting" />
                <span className="rail-label">Wait</span>
              </NavLink>
            )
          ) : (
            <NavLink to="/login" title="Log in" aria-label="Log in">
              <Icon d={I.login} label="Log in" />
              <span className="rail-label">Login</span>
            </NavLink>
          )}
        </nav>
        <div className="rail-foot">
          <ThemeToggle />
          {user ? (
            <button
              type="button"
              className="rail-quit"
              title="Log out"
              aria-label="Log out"
              onClick={() => void logout()}
            >
              <Icon d="M10 17l5-5-5-5M15 12H3M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" label="Log out" />
            </button>
          ) : (
            <Link className="rail-cta" to="/register" title="Get started">
              +
            </Link>
          )}
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-left">
            <Link to={home} className="brand-link">
              <span>THRUM</span>
            </Link>
            {user ? (
              <>
                <span className="topbar-scope mono">{user.username}</span>
                {isAdmin ? <span className="admin-badge">admin</span> : null}
              </>
            ) : null}
          </div>
          <div className="topbar-right">
            {user && approved ? (
              <Link className="btn" to="/monitors/new">
                New monitor
              </Link>
            ) : null}
            {!user ? (
              <>
                <Link className="btn ghost" to="/login">
                  Log in
                </Link>
                <Link className="btn" to="/register">
                  Get started
                </Link>
              </>
            ) : null}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
