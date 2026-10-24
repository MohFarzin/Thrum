import { useEffect, useState, type MouseEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'
import { withinWindow } from '../lib/ranges'

export function MonitorsList() {
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
    const t = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(t)
  }, [user])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

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
          <p className="eyebrow">Targets</p>
          <h1>Monitors</h1>
          <p className="lede">Everything THRUM is listening to · bars show 1h.</p>
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
