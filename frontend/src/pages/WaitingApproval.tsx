import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function WaitingApproval() {
  const { user, loading, logout, refresh } = useAuth()

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (user.is_admin || user.is_approved) return <Navigate to="/dashboard" replace />

  return (
    <section className="page waiting-page">
      <p className="eyebrow">Pending</p>
      <h1>Waiting for approval</h1>
      <p className="lede">
        Your account is signed in but an admin must approve it before you can use monitors,
        alerts, or logs.
      </p>
      <div className="waiting-card">
        <div className="waiting-row">
          <span className="meta">User ID</span>
          <strong className="mono">{user.id}</strong>
        </div>
        <div className="waiting-row">
          <span className="meta">Username</span>
          <strong className="mono">{user.username}</strong>
        </div>
        <p className="meta" style={{ marginTop: '0.85rem' }}>
          Share your user ID with an admin if they ask. You can refresh after they approve.
        </p>
      </div>
      <div className="actions" style={{ marginTop: '1.25rem' }}>
        <button type="button" className="btn" onClick={() => void refresh()}>
          Check again
        </button>
        <button type="button" className="btn ghost" onClick={() => void logout()}>
          Log out
        </button>
        <Link className="btn ghost" to="/">
          Home
        </Link>
      </div>
    </section>
  )
}
