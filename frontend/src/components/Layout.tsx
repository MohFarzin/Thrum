import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BrandMark } from './BrandMark'
import { ThemeToggle } from './ThemeToggle'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="layout">
      <div className="ambient" aria-hidden />
      <header className="topbar">
        <Link to="/" className="brand-link">
          <BrandMark size={30} />
          <span>THRUM</span>
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/monitors">Monitors</NavLink>
              <NavLink to="/alerts">Alerts</NavLink>
              <span className="nav-user">{user.username}</span>
              <button type="button" className="btn ghost tiny" onClick={() => void logout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link className="btn tiny" to="/register">
                Get started
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
