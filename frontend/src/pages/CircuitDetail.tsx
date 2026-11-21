import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { BarSegment, Circuit, MonitorStatus } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { UptimePie } from '../components/UptimePie'
import { useAuth } from '../hooks/useAuth'
import { DETAIL_RANGES, type BarRange } from '../lib/ranges'

type MemberRow = {
  id: string
  name: string
  type: string
  status: MonitorStatus
  is_enabled: boolean
  interval_seconds: number
  last_checked_at: string | null
  bar: BarSegment[]
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function CircuitDetail() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const [circuit, setCircuit] = useState<Circuit | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [range, setRange] = useState<BarRange>('1h')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const [c, mem] = await Promise.all([
      api<Circuit>(`/api/circuits/${id}/?range=${range}`),
      api<{ monitors: MemberRow[] }>(`/api/circuits/${id}/members/?range=${range}`),
    ])
    setCircuit(c)
    setMembers(mem.monitors || [])
  }, [id, range])

  useEffect(() => {
    if (!user || !id) return
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
    const t = window.setInterval(() => {
      void load().catch(() => {})
    }, 30000)
    return () => window.clearInterval(t)
  }, [user, id, load])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (!circuit && !error) return <p className="meta">Loading…</p>
  if (!circuit) {
    return (
      <section className="page">
        <p className="error">{error || 'Not found'}</p>
        <Link to="/circuits">← Circuits</Link>
      </section>
    )
  }

  const rangeLabel = DETAIL_RANGES.find((r) => r.id === range)?.label ?? range

  return (
    <section className="page">
      <Link className="back-link" to="/circuits">
        ← Circuits
      </Link>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Circuit</p>
          <h1>{circuit.name}</h1>
          {circuit.description ? <p className="lede">{circuit.description}</p> : null}
          <p className="meta">
            {circuit.monitor_count} pulses · {circuit.up_now} up · {circuit.down_now} down
            {circuit.is_public ? ' · public' : ''}
          </p>
        </div>
        <div className="actions">
          <div className="range-tabs" role="tablist" aria-label="Health range">
            {DETAIL_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={range === r.id}
                className={`range-tab${range === r.id ? ' on' : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Link className="btn" to={`/circuits/${circuit.id}/edit`}>
            Edit
          </Link>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="dash-hero">
        <div className="dash-pie-wrap">
          <UptimePie health={circuit.health} size={180} label={`Circuit · ${rangeLabel}`} />
        </div>
        <div className="kpi-strip">
          <div className="kpi-cell">
            <span className="kpi-label">Pulses</span>
            <span className="kpi-value">{circuit.monitor_count}</span>
            <span className="kpi-hint">in circuit</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Up now</span>
            <span className={`kpi-value${circuit.up_now ? ' up' : ''}`}>{circuit.up_now}</span>
            <span className="kpi-hint">passing</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Down now</span>
            <span className={`kpi-value${circuit.down_now ? ' down' : ''}`}>{circuit.down_now}</span>
            <span className="kpi-hint">attention</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Uptime</span>
            <span className="kpi-value">
              {circuit.health.uptime_pct != null ? `${circuit.health.uptime_pct}%` : '—'}
            </span>
            <span className="kpi-hint">{rangeLabel}</span>
          </div>
        </div>
      </div>

      <div className="row-between section-head">
        <h2>Pulses · {rangeLabel}</h2>
        <span className="meta">Availability bars</span>
      </div>

      {members.length === 0 ? (
        <div className="empty-card">
          <p>No pulses in this circuit yet.</p>
          <Link className="btn" to={`/circuits/${circuit.id}/edit`}>
            Add pulses
          </Link>
        </div>
      ) : (
        <div className="monitor-stack">
          {members.map((m) => (
            <article key={m.id} className="monitor-tile">
              <div className="monitor-tile-top">
                <div className="monitor-tile-id">
                  <Link to={`/monitors/${m.id}`} className="monitor-tile-name">
                    {m.name}
                  </Link>
                  <span className={`type-badge ${m.type}`}>{m.type}</span>
                  {!m.is_enabled ? <span className="meta">disabled</span> : null}
                </div>
                <StatusPill status={m.status} />
              </div>
              <div className="monitor-tile-bar">
                <HeartbeatBar status={m.status} results={m.bar || []} interactive={false} />
              </div>
              <div className="monitor-tile-foot">
                <span className="meta mono">
                  {m.is_enabled ? `every ${m.interval_seconds}s` : 'off'} · last{' '}
                  {fmtTime(m.last_checked_at)}
                </span>
                <Link className="btn tiny" to={`/monitors/${m.id}`}>
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
