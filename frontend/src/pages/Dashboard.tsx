import { useEffect, useState, type MouseEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'
import { withinWindow } from '../lib/ranges'

export function Dashboard() {
  const { user, loading } = useAuth()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [error, setError] = useState('')
  const [favBusy, setFavBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const load = () =>
      api<Monitor[]>('/api/monitors/')
        .then(setMonitors)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
    void load()
    const t = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(t)
  }, [user])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  const up = monitors.filter((m) => m.status === 'up').length
  const down = monitors.filter((m) => m.status === 'down').length
  const unknown = monitors.filter((m) => m.status === 'unknown').length
  const favCount = monitors.filter((m) => m.is_favorite).length

  async function toggleFavorite(m: Monitor, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (favBusy) return
    setFavBusy(m.id)
    try {
      const updated = await api<Monitor>(`/api/monitors/${m.id}/favorite/`, {
        method: 'POST',
        body: JSON.stringify({ is_favorite: !m.is_favorite }),
      })
      setMonitors((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Favorite failed')
    } finally {
      setFavBusy(null)
    }
  }

  return (
    <section className="page">
      <div className="row-between">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
          <p className="lede">Hi {user.username} — last hour on the wire.</p>
        </div>
        <Link className="btn" to="/monitors/new">
          Add monitor
        </Link>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="stat-grid">
        <article className="stat-card">
          <span className="stat-label">Monitors</span>
          <strong>{monitors.length}</strong>
        </article>
        <article className="stat-card tone-up">
          <span className="stat-label">Up</span>
          <strong>{up}</strong>
        </article>
        <article className="stat-card tone-down">
          <span className="stat-label">Down</span>
          <strong>{down}</strong>
        </article>
        <article className="stat-card tone-unknown">
          <span className="stat-label">Unknown</span>
          <strong>{unknown}</strong>
        </article>
      </div>

      <div className="row-between section-head">
        <h2>Monitors · 1h</h2>
        <span className="meta">
          {favCount}/6 starred · <Link to="/monitors">View all</Link>
        </span>
      </div>

      {monitors.length === 0 ? (
        <div className="empty-card">
          <p>No monitors yet. Add an HTTP, TCP, or heartbeat target to start listening.</p>
          <Link className="btn" to="/monitors/new">
            Create your first monitor
          </Link>
        </div>
      ) : (
        <div className="monitor-grid">
          {monitors.map((m) => (
            <Link key={m.id} className="monitor-card" to={`/monitors/${m.id}`}>
              <div className="monitor-card-top">
                <div>
                  <h3>{m.name}</h3>
                  <p className="muted truncate">{m.target || m.type}</p>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className={`star-btn${m.is_favorite ? ' on' : ''}`}
                    aria-label={m.is_favorite ? 'Unfavorite' : 'Favorite'}
                    disabled={favBusy === m.id}
                    onClick={(e) => void toggleFavorite(m, e)}
                  >
                    ★
                  </button>
                  <StatusPill status={m.status} />
                </div>
              </div>
              <HeartbeatBar
                status={m.status}
                results={withinWindow(m.recent_results, 60 * 60 * 1000)}
                interactive={false}
                ageFade
              />
              <div className="monitor-card-foot">
                <span className="type-chip">{m.type}</span>
                <span className="muted">
                  {m.is_enabled ? `${m.interval_seconds}s` : 'disabled'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="meta foot-note">Bars show the last hour. Open a monitor for longer ranges.</p>
    </section>
  )
}
