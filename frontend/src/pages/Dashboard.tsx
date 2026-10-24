import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'

export function Dashboard() {
  const { user, loading } = useAuth()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [error, setError] = useState('')

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
  const recent = monitors.slice(0, 5)

  return (
    <section className="page">
      <div className="row-between">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
          <p className="lede">Hi {user.username} — here’s the pulse of your stack.</p>
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
        <h2>Recent monitors</h2>
        <Link to="/monitors">View all</Link>
      </div>

      {recent.length === 0 ? (
        <div className="empty-card">
          <p>No monitors yet. Add an HTTP, TCP, or heartbeat target to start listening.</p>
          <Link className="btn" to="/monitors/new">
            Create your first monitor
          </Link>
        </div>
      ) : (
        <div className="monitor-grid">
          {recent.map((m) => (
            <Link key={m.id} className="monitor-card" to={`/monitors/${m.id}`}>
              <div className="monitor-card-top">
                <div>
                  <h3>{m.name}</h3>
                  <p className="muted truncate">{m.target || m.type}</p>
                </div>
                <StatusPill status={m.status} />
              </div>
              <HeartbeatBar
                status={m.status}
                results={m.recent_results}
                interactive={false}
                segments={36}
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
      <p className="meta foot-note">Status refreshes every 15s. Open a monitor for check history.</p>
    </section>
  )
}
