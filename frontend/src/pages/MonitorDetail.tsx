import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
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
  const location = useLocation()
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [results, setResults] = useState<CheckResult[]>([])
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(
    () => (location.state as { apiKey?: string } | null)?.apiKey ?? null,
  )
  const [rotating, setRotating] = useState(false)
  const [picked, setPicked] = useState<CheckResult | null>(null)

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

  async function onRotateKey() {
    if (!id || !confirm('Rotate API key? The old key stops working immediately.')) return
    setRotating(true)
    setError('')
    try {
      const res = await api<Monitor>(`/api/monitors/${id}/rotate-key/`, { method: 'POST' })
      setMonitor(res)
      if (res.api_key) setRevealedKey(res.api_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotate failed')
    } finally {
      setRotating(false)
    }
  }

  if (error && !monitor) return <p className="error">{error}</p>
  if (!monitor) return <p className="meta">Loading…</p>

  const canCheck = monitor.type === 'http' || monitor.type === 'tcp'
  const isHeartbeat = monitor.type === 'heartbeat'
  const latest = results[0]
  // One-line curl works in Windows CMD and Unix shells (no bash \\ continuations).
  const curl = `curl -X POST "${window.location.origin}/api/v1/heartbeat/${monitor.id}/" -H "Authorization: Bearer ${revealedKey || 'YOUR_API_KEY'}" -H "Content-Type: application/json" -d "{\\"status\\":\\"ok\\"}"`

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

      {isHeartbeat ? (
        <div className="detail-panel key-panel">
          <h2>Agent API key</h2>
          {revealedKey ? (
            <>
              <p className="warn-text">Copy now — this full key is only shown once.</p>
              <code className="key-reveal">{revealedKey}</code>
              <button
                type="button"
                className="btn tiny ghost"
                onClick={() => void navigator.clipboard.writeText(revealedKey)}
              >
                Copy key
              </button>
            </>
          ) : (
            <p className="meta">
              Prefix <code>{monitor.api_key_prefix || '—'}…</code> (full key hidden). Rotate to
              mint a new one.
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="btn tiny"
              disabled={rotating}
              onClick={() => void onRotateKey()}
            >
              {rotating ? 'Rotating…' : 'Rotate key'}
            </button>
          </div>
          <h3 className="curl-heading">Send a heartbeat</h3>
          <p className="meta">
            Keep sending at least every {monitor.interval_seconds + monitor.heartbeat_grace_seconds}s
            (interval + grace). A single curl only proves one beat — after that the watchdog will
            mark soft fails (orange) then down (red).
          </p>
          <pre className="curl-block">{curl}</pre>
        </div>
      ) : null}

      <div className="detail-panel">
        <h2>Availability</h2>
        <p className="meta" style={{ marginBottom: '0.65rem' }}>
          Last check {fmtTime(monitor.last_checked_at)}
          {latest?.latency_ms != null ? ` · ${latest.latency_ms} ms` : ''}
          {monitor.consecutive_failures > 0
            ? ` · ${monitor.consecutive_failures} consecutive fail${monitor.consecutive_failures === 1 ? '' : 's'}`
            : ''}
          {' · '}
          green OK · orange first fail · red confirmed down
        </p>
        <HeartbeatBar
          status={monitor.status}
          segments={56}
          results={results}
          onSelect={setPicked}
        />
        {picked ? (
          <p className="meta">
            Selected: {fmtTime(picked.checked_at)}
            {picked.success ? ' · OK' : ' · fail'}
            {picked.latency_ms != null ? ` · ${picked.latency_ms} ms` : ''}
            {picked.status_code != null ? ` · HTTP ${picked.status_code}` : ''}
            {picked.error_message ? ` · ${picked.error_message}` : ''}
          </p>
        ) : results.length === 0 ? (
          <p className="meta">
            {canCheck
              ? 'No checks yet — wait for the scheduler or hit Check now.'
              : isHeartbeat
                ? 'Waiting for the first agent heartbeat.'
                : 'No data yet.'}
          </p>
        ) : null}
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
        {isHeartbeat ? (
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
