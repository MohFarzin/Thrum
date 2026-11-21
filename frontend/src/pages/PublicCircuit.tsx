import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { BarSegment, HealthSlice, MonitorStatus } from '../api/types'
import { BrandMark } from '../components/BrandMark'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { UptimePie } from '../components/UptimePie'
import { DETAIL_RANGES, type BarRange } from '../lib/ranges'

type PublicMember = {
  name: string
  type: string
  status: MonitorStatus
  is_enabled: boolean
  bar?: BarSegment[]
}

type PublicCircuitPayload = {
  name: string
  description: string
  range: string
  show_graph: boolean
  health: HealthSlice
  counts: { total: number; up: number; down: number; unknown: number }
  monitors: PublicMember[]
  visibility: string
}

export function PublicCircuit() {
  const { slug } = useParams()
  const [range, setRange] = useState<BarRange>('1d')
  const [data, setData] = useState<PublicCircuitPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    const load = () =>
      fetch(`/api/public/circuit/${slug}/?range=${range}`, { credentials: 'omit' })
        .then(async (res) => {
          if (!res.ok) throw new Error(res.status === 404 ? 'Not found or sharing off' : 'Failed')
          return res.json() as Promise<PublicCircuitPayload>
        })
        .then(setData)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
    void load()
    const t = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(t)
  }, [slug, range])

  if (error) {
    return (
      <section className="page public-status">
        <p className="error">{error}</p>
        <Link to="/">← THRUM</Link>
      </section>
    )
  }
  if (!data) return <p className="meta">Loading…</p>

  const rangeLabel = DETAIL_RANGES.find((r) => r.id === range)?.label ?? range
  const showGraph = Boolean(data.show_graph)

  return (
    <section className="page public-status">
      <div className="hero-brand-row" style={{ marginBottom: '1.25rem' }}>
        <BrandMark size={36} />
        <Link to="/" className="brand-link" style={{ fontSize: '1.1rem' }}>
          THRUM
        </Link>
      </div>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Public circuit</p>
          <h1>{data.name}</h1>
          {data.description ? <p className="lede">{data.description}</p> : null}
          <p className="meta">
            {data.counts.total} pulses · {data.counts.up} up · {data.counts.down} down
            {showGraph ? ' · graphs on' : ' · status only'}
          </p>
        </div>
        {showGraph ? (
          <div className="range-tabs" role="tablist" aria-label="Range">
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
        ) : null}
      </div>

      <div className="dash-hero">
        <div className="dash-pie-wrap">
          <UptimePie health={data.health} size={180} label={`Circuit · ${rangeLabel}`} />
        </div>
        <div className="kpi-strip">
          <div className="kpi-cell">
            <span className="kpi-label">Pulses</span>
            <span className="kpi-value">{data.counts.total}</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Up</span>
            <span className={`kpi-value${data.counts.up ? ' up' : ''}`}>{data.counts.up}</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Down</span>
            <span className={`kpi-value${data.counts.down ? ' down' : ''}`}>{data.counts.down}</span>
          </div>
          <div className="kpi-cell">
            <span className="kpi-label">Uptime</span>
            <span className="kpi-value">
              {data.health.uptime_pct != null ? `${data.health.uptime_pct}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="row-between section-head">
        <h2>Pulses{showGraph ? ` · ${rangeLabel}` : ''}</h2>
        <span className="meta">{showGraph ? 'Bars + status' : 'Status only'}</span>
      </div>

      {showGraph ? (
        <div className="monitor-stack">
          {data.monitors.map((m) => (
            <article key={`${m.name}-${m.type}`} className="monitor-tile">
              <div className="monitor-tile-top">
                <div className="monitor-tile-id">
                  <span className="monitor-tile-name">{m.name}</span>
                  <span className={`type-badge ${m.type}`}>{m.type}</span>
                  {!m.is_enabled ? <span className="meta">off</span> : null}
                </div>
                <StatusPill status={m.status} />
              </div>
              <div className="monitor-tile-bar">
                <HeartbeatBar status={m.status} results={m.bar || []} interactive={false} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <ul className="circuit-public-list">
          {data.monitors.map((m) => (
            <li key={`${m.name}-${m.type}`}>
              <span>{m.name}</span>
              <span className={`type-badge ${m.type}`}>{m.type}</span>
              <StatusPill status={m.status} />
              {!m.is_enabled ? <span className="meta">off</span> : null}
            </li>
          ))}
        </ul>
      )}
      {data.monitors.length === 0 ? <p className="meta">No pulses in this circuit.</p> : null}
    </section>
  )
}
