import { useEffect, useState, type MouseEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Circuit, HealthSlice, Monitor } from '../api/types'
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
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [fleet, setFleet] = useState<HealthSlice | null>(null)
  const [fleetRange, setFleetRange] = useState<(typeof FLEET_RANGES)[number]['id']>('1d')
  const [error, setError] = useState('')
  const [favBusy, setFavBusy] = useState<string | null>(null)
  const [checkBusy, setCheckBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const load = () => {
      void api<Monitor[]>('/api/monitors/?unassigned=1')
        .then(setMonitors)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      void api<HealthSlice>(`/api/monitors/fleet-health/?range=${fleetRange}`)
        .then(setFleet)
        .catch(() => setFleet(null))
      void api<Circuit[]>(`/api/circuits/?range=${fleetRange}`)
        .then(setCircuits)
        .catch(() => setCircuits([]))
    }
    load()
    const t = window.setInterval(load, 30000)
    return () => window.clearInterval(t)
  }, [user, fleetRange])

  if (loading) return <p className="meta">Loading pulse…</p>
  if (!user) return <Navigate to="/login" replace />

  const up = monitors.filter((m) => m.status === 'up').length
  const down = monitors.filter((m) => m.status === 'down').length
  const unknown = monitors.filter((m) => m.status === 'unknown').length
  const favCount = monitors.filter((m) => m.is_favorite).length
  const rangeLabel = FLEET_RANGES.find((r) => r.id === fleetRange)?.label ?? fleetRange

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

  async function checkNow(m: Monitor, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (checkBusy || !m.is_enabled) return
    if (m.type !== 'http' && m.type !== 'tcp' && m.type !== 'udp') return
    setCheckBusy(m.id)
    setError('')
    try {
      const res = await api<{ monitor: Monitor }>(`/api/monitors/${m.id}/check/`, {
        method: 'POST',
      })
      setMonitors((prev) =>
        prev.map((x) => (x.id === res.monitor.id ? { ...x, ...res.monitor } : x)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setCheckBusy(null)
    }
  }

  return (
    <section className="page">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Pulse</p>
          <h1>Dashboard</h1>
          <p className="lede">
            Ungrouped pulses · {rangeLabel} · {monitors.length} free · {favCount}/6 starred · circuit
            members live under Circuits
          </p>
        </div>
        <div className="actions">
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
          <Link className="btn" to="/monitors/new">
            New monitor
          </Link>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="dash-hero">
        <div className="dash-pie-wrap">
          <UptimePie health={fleet} size={180} label={`Ungrouped · ${rangeLabel}`} />
        </div>
        <div className="kpi-strip">
          <div className="kpi-cell">
            <span className="kpi-label">Monitors</span>
            <span className="kpi-value">{monitors.length}</span>
            <span className="kpi-hint">listening</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Up now</span>
            <span className={`kpi-value${up ? ' up' : ''}`}>{up}</span>
            <span className="kpi-hint">passing</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Down now</span>
            <span className={`kpi-value${down ? ' down' : ''}`}>{down}</span>
            <span className="kpi-hint">attention</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Unknown</span>
            <span className={`kpi-value${unknown ? ' unk' : ''}`}>{unknown}</span>
            <span className="kpi-hint">no sample</span>
          </div>
        </div>
      </div>

      <div className="row-between section-head">
        <h2>Circuits</h2>
        <Link className="btn ghost tiny" to="/circuits">
          Manage
        </Link>
      </div>
      {circuits.length === 0 ? (
        <div className="empty-card" style={{ marginBottom: '1.5rem' }}>
          <p>No circuits yet. Group pulses for per-circuit pies, Discord alerts, and public stats.</p>
          <Link className="btn" to="/circuits">
            Create circuit
          </Link>
        </div>
      ) : (
        <div className="circuit-grid" style={{ marginBottom: '2rem' }}>
          {circuits.map((c) => (
            <Link key={c.id} to={`/circuits/${c.id}`} className="circuit-card">
              <header className="circuit-card-head">
                <h2 className="circuit-card-title">{c.name || 'Untitled'}</h2>
                {c.is_public ? <span className="share-chip">public</span> : null}
              </header>
              <div className="circuit-card-body">
                <UptimePie health={c.health} size={88} label={rangeLabel} compact />
                <dl className="circuit-card-stats">
                  <div>
                    <dt>Pulses</dt>
                    <dd>{c.monitor_count}</dd>
                  </div>
                  <div>
                    <dt>Up</dt>
                    <dd className={c.up_now ? 'up' : undefined}>{c.up_now}</dd>
                  </div>
                  <div>
                    <dt>Down</dt>
                    <dd className={c.down_now ? 'down' : undefined}>{c.down_now}</dd>
                  </div>
                  <div>
                    <dt>{rangeLabel}</dt>
                    <dd>{c.health.uptime_pct != null ? `${c.health.uptime_pct}%` : '—'}</dd>
                  </div>
                </dl>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="row-between section-head">
        <h2>Ungrouped pulse · last 1h</h2>
        <span className="meta">Not in any circuit</span>
      </div>

      {monitors.length === 0 ? (
        <div className="empty-card">
          <p>
            No ungrouped pulses. Everything is in a circuit, or create a new HTTP / TCP / UDP /
            heartbeat monitor.
          </p>
          <Link className="btn" to="/monitors/new">
            New monitor
          </Link>
        </div>
      ) : (
        <div className="monitor-stack">
          {monitors.map((m) => {
            const probe = m.type === 'http' || m.type === 'tcp' || m.type === 'udp'
            return (
              <article key={m.id} className="monitor-tile">
                <div className="monitor-tile-top">
                  <div className="monitor-tile-id">
                    <Link to={`/monitors/${m.id}`} className="monitor-tile-name">
                      {m.name}
                    </Link>
                    <span className={`type-badge ${m.type}`}>{m.type}</span>
                    {m.is_public ? <span className="share-chip">public</span> : null}
                    {!m.is_enabled ? <span className="meta">disabled</span> : null}
                  </div>
                  <div className="monitor-tile-status">
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
                <p className="monitor-tile-target mono">{m.target || 'Heartbeat only'}</p>
                <div className="monitor-tile-bar">
                  <HeartbeatBar
                    status={m.status}
                    results={withinWindow(m.recent_results, 60 * 60 * 1000)}
                    interactive={false}
                  />
                </div>
                <div className="monitor-tile-foot">
                  <span className="meta mono">
                    {m.is_enabled ? `every ${m.interval_seconds}s` : 'off'}
                  </span>
                  <div className="monitor-tile-actions">
                    {probe ? (
                      <button
                        type="button"
                        className="btn ghost tiny"
                        disabled={checkBusy === m.id || !m.is_enabled}
                        onClick={(e) => void checkNow(m, e)}
                      >
                        {checkBusy === m.id ? '…' : 'Check'}
                      </button>
                    ) : null}
                    <Link className="btn ghost tiny" to={`/monitors/${m.id}/edit`}>
                      Edit
                    </Link>
                    <Link className="btn tiny" to={`/monitors/${m.id}`}>
                      Open
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
