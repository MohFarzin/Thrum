import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { BarSegment, HealthSlice, Incident, MonitorStatus, UptimeSummary } from '../api/types'
import { BrandMark } from '../components/BrandMark'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { UptimePie } from '../components/UptimePie'

type PublicPayload = {
  name: string
  type: string
  status: MonitorStatus
  last_checked_at: string | null
  interval_seconds: number
  range: string
  bar: BarSegment[]
  uptime: UptimeSummary
  health: HealthSlice
  incidents: Incident[]
  visibility: string
}

const RANGES = [
  { id: '1h', label: '1h' },
  { id: '1d', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
] as const

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v}%`
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function PublicStatus() {
  const { slug } = useParams()
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('1d')
  const [data, setData] = useState<PublicPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    const load = () =>
      fetch(`/api/public/status/${slug}/?range=${range}`, { credentials: 'omit' })
        .then(async (res) => {
          if (!res.ok) throw new Error(res.status === 404 ? 'Not found or sharing off' : 'Failed')
          return res.json() as Promise<PublicPayload>
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

  return (
    <section className="page public-status">
      <div className="hero-brand-row" style={{ marginBottom: '1.25rem' }}>
        <BrandMark size={36} />
        <Link to="/" className="brand-link" style={{ fontSize: '1.1rem' }}>
          THRUM
        </Link>
      </div>
      <div className="detail-hero">
        <div>
          <p className="eyebrow">Public status · {data.type}</p>
          <h1>{data.name}</h1>
        </div>
        <StatusPill status={data.status} />
      </div>

      <div className="log-banner public">Public page · no login · target host hidden</div>

      <div className="range-tabs" role="tablist" aria-label="Status range">
        {RANGES.map((r) => (
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

      <div className="health-hero public-health">
        <UptimePie health={data.health} size={200} label={`Uptime · ${range}`} />
      </div>

      <div className="uptime-row">
        <span>
          <em>10m</em> {fmtPct(data.uptime['10m'])}
        </span>
        <span>
          <em>1h</em> {fmtPct(data.uptime['1h'])}
        </span>
        <span>
          <em>1d</em> {fmtPct(data.uptime['1d'])}
        </span>
        <span>
          <em>1w</em> {fmtPct(data.uptime['7d'])}
        </span>
        <span>
          <em>30d</em> {fmtPct(data.uptime['30d'])}
        </span>
      </div>

      <div className="detail-panel">
        <p className="meta">History · {range}</p>
        <HeartbeatBar status={data.status} results={data.bar} interactive={false} />
      </div>

      <div className="detail-panel">
        <h2>Recent incidents</h2>
        <p className="meta">Downtime windows visible on this public page.</p>
        {(data.incidents || []).length === 0 ? (
          <p className="meta empty-inline">No incidents in this range.</p>
        ) : (
          <ul className="incident-list">
            {data.incidents.map((inc, i) => (
              <li key={`${inc.started_at}-${i}`}>
                <time dateTime={inc.started_at}>{fmtTime(inc.started_at)}</time>
                <span className="incident-dur">{inc.duration_human}</span>
                <span className="incident-err">{inc.error_message || 'down'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="meta foot-note">Shared status · refreshes every 30s · last check {data.last_checked_at ? fmtTime(data.last_checked_at) : '—'}</p>
    </section>
  )
}
