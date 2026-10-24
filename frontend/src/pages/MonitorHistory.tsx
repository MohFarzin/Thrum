import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { BarSegment, CheckResult, Monitor } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'
import { HISTORY_RANGES, type BarRange } from '../lib/ranges'

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function MonitorHistory() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const range = (HISTORY_RANGES.some((r) => r.id === params.get('range'))
    ? params.get('range')
    : '1d') as BarRange

  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [results, setResults] = useState<BarSegment[]>([])
  const [list, setList] = useState<CheckResult[]>([])
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    if (!user || !id) return
    const [m, buckets, recent] = await Promise.all([
      api<Monitor>(`/api/monitors/${id}/`),
      api<BarSegment[]>(`/api/monitors/${id}/results/?range=${range}&bar=1`),
      api<CheckResult[]>(`/api/monitors/${id}/results/?range=${range}&limit=200`),
    ])
    setMonitor(m)
    setResults(buckets)
    setList(recent)
  }, [user, id, range])

  useEffect(() => {
    if (!user || !id) return
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [user, id, load])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (error && !monitor) return <p className="error">{error}</p>
  if (!monitor) return <p className="meta">Loading…</p>

  return (
    <section className="page">
      <Link className="back-link" to={`/monitors/${monitor.id}`}>
        ← {monitor.name}
      </Link>
      <div className="detail-hero">
        <div>
          <p className="eyebrow">History</p>
          <h1>{monitor.name}</h1>
          <p className="lede truncate">{monitor.target || monitor.type}</p>
        </div>
        <StatusPill status={monitor.status} />
      </div>

      <div className="range-tabs" role="tablist" aria-label="History range">
        {HISTORY_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={`range-tab${range === r.id ? ' on' : ''}`}
            onClick={() => setParams({ range: r.id })}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="detail-panel avail-panel">
        <HeartbeatBar status={monitor.status} results={results} />
      </div>

      <div className="row-between section-head">
        <h2>Checks</h2>
      </div>
      <ul className="check-list">
        {list.map((r) => (
          <li key={r.id}>
            <span className={r.success ? 'ok' : 'bad'}>{r.success ? 'UP' : 'DOWN'}</span>
            <span className="muted">{fmtTime(r.checked_at)}</span>
            <span className="muted">
              {r.latency_ms != null ? `${r.latency_ms}ms` : '—'}
              {r.status_code != null ? ` · HTTP ${r.status_code}` : ''}
            </span>
            {!r.success && r.error_message ? <span className="err-msg">{r.error_message}</span> : null}
          </li>
        ))}
      </ul>
      {list.length === 0 ? <p className="meta">No checks in this window.</p> : null}
    </section>
  )
}
