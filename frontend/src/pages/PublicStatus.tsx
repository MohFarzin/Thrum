import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { BarSegment, MonitorStatus, UptimeSummary } from '../api/types'
import { BrandMark } from '../components/BrandMark'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'

type PublicPayload = {
  name: string
  type: string
  status: MonitorStatus
  last_checked_at: string | null
  interval_seconds: number
  range: string
  bar: BarSegment[]
  uptime: UptimeSummary
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v}%`
}

export function PublicStatus() {
  const { slug } = useParams()
  const [data, setData] = useState<PublicPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    const load = () =>
      fetch(`/api/public/status/${slug}/?range=1h`, { credentials: 'omit' })
        .then(async (res) => {
          if (!res.ok) throw new Error(res.status === 404 ? 'Not found or sharing off' : 'Failed')
          return res.json() as Promise<PublicPayload>
        })
        .then(setData)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
    void load()
    const t = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(t)
  }, [slug])

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
        <p className="meta">Last hour</p>
        <HeartbeatBar status={data.status} results={data.bar} interactive={false} />
      </div>
      <p className="meta foot-note">Shared status page · refreshes every 20s</p>
    </section>
  )
}
