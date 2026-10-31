import { useEffect, useState, type MouseEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { HealthSlice, Monitor } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { UptimePie } from '../components/UptimePie'
import { useAuth } from '../hooks/useAuth'
import { withinWindow } from '../lib/ranges'

const FLEET_RANGES = [
  { id: '1h', label: '1h' },
  { id: '1d', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
] as const

export function Dashboard() {
  const { user, loading } = useAuth()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [fleet, setFleet] = useState<HealthSlice | null>(null)
  const [fleetRange, setFleetRange] = useState<(typeof FLEET_RANGES)[number]['id']>('1d')
  const [error, setError] = useState('')
  const [favBusy, setFavBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const load = () => {
      void api<Monitor[]>('/api/monitors/')
        .then(setMonitors)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      void api<HealthSlice>(`/api/monitors/fleet-health/?range=${fleetRange}`)
        .then(setFleet)
        .catch(() => setFleet(null))
    }
    load()
    const t = window.setInterval(load, 30000)
    return () => window.clearInterval(t)
  }, [user, fleetRange])

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
          <p className="lede">Hi {user.username} — fleet pulse at a glance.</p>
        </div>
        <div className="actions">
          <Link className="btn ghost" to="/logs">
            Audit log
          </Link>
          <Link className="btn" to="/monitors/new">
            Add monitor
          </Link>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="dash-hero">
        <div className="dash-pie-wrap">
          <div className="range-tabs" role="tablist" aria-label="Fleet range">
            {FLEET_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={fleetRange === r.id}
                className={`range-tab${fleetRange === r.id ? ' on' : ''}`}
                onClick={() => setFleetRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <UptimePie health={fleet} size={200} label={`All monitors · ${fleetRange}`} />
        </div>
        <div className="stat-grid compact">
          <article className="stat-card">
            <span className="stat-label">Monitors</span>
            <strong>{monitors.length}</strong>
          </article>
          <article className="stat-card tone-up">
            <span className="stat-label">Up now</span>
            <strong>{up}</strong>
          </article>
          <article className="stat-card tone-down">
            <span className="stat-label">Down now</span>
            <strong>{down}</strong>
          </article>
          <article className="stat-card tone-unknown">
            <span className="stat-label">Unknown</span>
            <strong>{unknown}</strong>
          </article>
        </div>
      </div>

      <div className="row-between section-head">
        <h2>Monitors · 1h</h2>
        <span className="meta">
          {favCount}/6 starred · <Link to="/monitors">View all</Link>
        </span>
      </div>

      {monitors.length === 0 ? (
        <div className="empty-card">
          <p>No monitors yet. Add HTTP, TCP, UDP, or heartbeat to start listening.</p>
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
              />
              <div className="monitor-card-foot">
                <span className="type-chip">{m.type}</span>
                <span className="muted">
                  {m.is_enabled ? `${m.interval_seconds}s` : 'disabled'}
                </span>
                {m.is_public ? <span className="share-chip">public</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="meta foot-note">Pie uses check outcomes in the selected range. Bars show the last hour.</p>
    </section>
  )
}
