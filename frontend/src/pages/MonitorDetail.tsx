import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { CheckResult, Monitor } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function MonitorDetail() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [results, setResults] = useState<CheckResult[]>([])
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const load = useCallback(async () => {
    if (!user || !id) return
    const [m, r] = await Promise.all([
      api<Monitor>(`/api/monitors/${id}/`),
      api<CheckResult[]>(`/api/monitors/${id}/results/?limit=56`),
    ])
    setMonitor(m)
    setResults(r)
  }, [user, id])

  useEffect(() => {
    if (!user || !id) return
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
    const t = window.setInterval(() => {
      void load().catch(() => {})
    }, 15000)
    return () => window.clearInterval(t)
  }, [user, id, load])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  async function onDelete() {
    if (!id || !confirm('Delete this monitor?')) return
    await api(`/api/monitors/${id}/`, { method: 'DELETE' })
    navigate('/monitors')
  }

  async function onCheckNow() {
    if (!id) return
    setChecking(true)
    setError('')
    try {
      const res = await api<{ monitor: Monitor; result: CheckResult | null }>(
        `/api/monitors/${id}/check/`,
        { method: 'POST' },
      )
      setMonitor(res.monitor)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  if (error && !monitor) return <p className="error">{error}</p>
  if (!monitor) return <p className="meta">Loading…</p>

  const canCheck = monitor.type === 'http' || monitor.type === 'tcp'
  const latest = results[0]

  return (
    <section className="page">
      <Link className="back-link" to="/monitors">
        ← Monitors
      </Link>
      <div className="detail-hero">
        <div>
          <p className="eyebrow">{monitor.type}</p>
          <h1>{monitor.name}</h1>
          <p className="lede truncate">{monitor.target || 'Heartbeat-only monitor'}</p>
        </div>
        <div className="actions">
          <StatusPill status={monitor.status} />
          {canCheck ? (
            <button
              type="button"
              className="btn tiny"
              disabled={checking || !monitor.is_enabled}
              onClick={() => void onCheckNow()}
            >
              {checking ? 'Checking…' : 'Check now'}
            </button>
          ) : null}
          <Link className="btn ghost" to={`/monitors/${monitor.id}/edit`}>
            Edit
          </Link>
          <button type="button" className="btn danger" onClick={() => void onDelete()}>
            Delete
          </button>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="detail-panel">
        <h2>Availability</h2>
        <HeartbeatBar status={monitor.status} segments={56} results={results} />
        <p className="meta">
          {results.length
            ? `Last ${results.length} checks · latest ${latest?.success ? 'OK' : 'fail'}${
                latest?.latency_ms != null ? ` · ${latest.latency_ms}ms` : ''
              }`
            : canCheck
              ? 'No checks yet — wait for the scheduler or hit Check now.'
              : 'Heartbeat ingest arrives in Phase 3.'}
        </p>
      </div>

      <dl className="detail-grid">
        <dt>Interval</dt>
        <dd>{monitor.interval_seconds}s</dd>
        <dt>Timeout</dt>
        <dd>{monitor.timeout_seconds}s</dd>
        {monitor.type === 'http' ? (
          <>
            <dt>Expected status</dt>
            <dd>{monitor.expected_status_code}</dd>
          </>
        ) : null}
        {monitor.type === 'heartbeat' ? (
          <>
            <dt>Grace</dt>
            <dd>{monitor.heartbeat_grace_seconds}s</dd>
          </>
        ) : null}
        <dt>Last check</dt>
        <dd>{fmtTime(monitor.last_checked_at)}</dd>
        <dt>Last heartbeat</dt>
        <dd>{fmtTime(monitor.last_heartbeat_at)}</dd>
        <dt>Failures</dt>
        <dd>{monitor.consecutive_failures}</dd>
        <dt>Enabled</dt>
        <dd>{monitor.is_enabled ? 'Yes' : 'No'}</dd>
        <dt>ID</dt>
        <dd>
          <code>{monitor.id}</code>
        </dd>
      </dl>

      {results.length > 0 ? (
        <div className="detail-panel" style={{ marginTop: '1.25rem' }}>
          <h2>Recent checks</h2>
          <ul className="check-list">
            {results.slice(0, 12).map((r) => (
              <li key={r.id}>
                <span className={r.success ? 'ok' : 'bad'}>{r.success ? 'UP' : 'DOWN'}</span>
                <span className="muted">{fmtTime(r.checked_at)}</span>
                <span className="muted">
                  {r.latency_ms != null ? `${r.latency_ms}ms` : '—'}
                  {r.status_code != null ? ` · HTTP ${r.status_code}` : ''}
                </span>
                {!r.success && r.error_message ? (
                  <span className="err-msg">{r.error_message}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
