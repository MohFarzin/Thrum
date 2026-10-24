import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'

export function MonitorsList() {
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

  return (
    <section className="page">
      <div className="row-between">
        <div>
          <p className="eyebrow">Targets</p>
          <h1>Monitors</h1>
          <p className="lede">Everything THRUM is listening to.</p>
        </div>
        <Link className="btn" to="/monitors/new">
          New monitor
        </Link>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {monitors.length === 0 ? (
        <div className="empty-card">
          <p>No monitors yet.</p>
          <Link className="btn" to="/monitors/new">
            Add monitor
          </Link>
        </div>
      ) : (
        <div className="monitor-grid">
          {monitors.map((m) => (
            <Link key={m.id} className="monitor-card" to={`/monitors/${m.id}`}>
              <div className="monitor-card-top">
                <div>
                  <h3>{m.name}</h3>
                  <p className="muted truncate">{m.target || 'Heartbeat only'}</p>
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
                  {m.is_enabled ? `every ${m.interval_seconds}s` : 'disabled'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
