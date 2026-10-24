import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { BarSegment, CheckResult, Monitor, UptimeSummary } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { HeartbeatCommands } from '../components/HeartbeatCommands'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'
import { DETAIL_RANGES, type BarRange } from '../lib/ranges'

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v}%`
}

type ConfirmKind = 'delete' | 'rotate' | 'refresh-share' | null

export function MonitorDetail() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [results, setResults] = useState<BarSegment[]>([])
  const [recentList, setRecentList] = useState<CheckResult[]>([])
  const [uptime, setUptime] = useState<UptimeSummary | null>(null)
  const [range, setRange] = useState<BarRange>('1h')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(
    () => (location.state as { apiKey?: string } | null)?.apiKey ?? null,
  )
  const [picked, setPicked] = useState<BarSegment | null>(null)
  const [favBusy, setFavBusy] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user || !id) return
    const [m, bar, list, up] = await Promise.all([
      api<Monitor>(`/api/monitors/${id}/`),
      api<BarSegment[]>(`/api/monitors/${id}/results/?range=${range}&bar=1`),
      api<CheckResult[]>(`/api/monitors/${id}/results/?range=1d&limit=15`),
      api<UptimeSummary>(`/api/monitors/${id}/uptime/`),
    ])
    setMonitor(m)
    setResults(bar)
    setRecentList(list)
    setUptime(up)
  }, [user, id, range])

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

  async function onRefreshBar() {
    setRefreshing(true)
    setError('')
    try {
      await load()
      setPicked(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  async function onToggleFavorite() {
    if (!monitor || favBusy) return
    setFavBusy(true)
    try {
      const updated = await api<Monitor>(`/api/monitors/${monitor.id}/favorite/`, {
        method: 'POST',
        body: JSON.stringify({ is_favorite: !monitor.is_favorite }),
      })
      setMonitor(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Favorite failed')
    } finally {
      setFavBusy(false)
    }
  }

  async function onToggleShare() {
    if (!monitor || shareBusy) return
    setShareBusy(true)
    setError('')
    try {
      const updated = await api<Monitor>(`/api/monitors/${monitor.id}/share/`, {
        method: 'POST',
        body: JSON.stringify({ is_public: !monitor.is_public }),
      })
      setMonitor(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share update failed')
    } finally {
      setShareBusy(false)
    }
  }

  async function runConfirm() {
    if (!id || !confirm) return
    setConfirmBusy(true)
    setError('')
    try {
      if (confirm === 'delete') {
        await api(`/api/monitors/${id}/`, { method: 'DELETE' })
        navigate('/monitors')
        return
      }
      if (confirm === 'refresh-share') {
        const updated = await api<Monitor>(`/api/monitors/${id}/share/`, {
          method: 'POST',
          body: JSON.stringify({ rotate_slug: true }),
        })
        setMonitor(updated)
        setConfirm(null)
        return
      }
      const res = await api<Monitor>(`/api/monitors/${id}/rotate-key/`, { method: 'POST' })
      setMonitor(res)
      if (res.api_key) setRevealedKey(res.api_key)
      setConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
      setConfirm(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  if (error && !monitor) return <p className="error">{error}</p>
  if (!monitor) return <p className="meta">Loading…</p>

  const canCheck = monitor.type === 'http' || monitor.type === 'tcp'
  const isHeartbeat = monitor.type === 'heartbeat'
  const latest = recentList[0]
  const hbUrl = `${window.location.origin}/api/v1/heartbeat/${monitor.id}/`
  const hbKey = revealedKey || 'YOUR_API_KEY'
  const sleepSec = Math.min(10, Math.max(5, Math.floor(monitor.interval_seconds / 2)))
  const shareUrl =
    monitor.is_public && monitor.public_slug
      ? `${window.location.origin}/s/${monitor.public_slug}`
      : null

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
          <button
            type="button"
            className={`star-btn lg${monitor.is_favorite ? ' on' : ''}`}
            aria-label={monitor.is_favorite ? 'Unfavorite' : 'Favorite'}
            disabled={favBusy}
            onClick={() => void onToggleFavorite()}
          >
            ★
          </button>
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
          <button type="button" className="btn danger" onClick={() => setConfirm('delete')}>
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
            <button type="button" className="btn tiny" onClick={() => setConfirm('rotate')}>
              Rotate key
            </button>
          </div>
          <p className="meta" style={{ marginTop: '0.85rem' }}>
            Window: every{' '}
            <strong>{monitor.interval_seconds + monitor.heartbeat_grace_seconds}s</strong> (interval{' '}
            {monitor.interval_seconds}s + grace {monitor.heartbeat_grace_seconds}s).
          </p>
          <HeartbeatCommands url={hbUrl} apiKey={hbKey} sleepSec={sleepSec} />
        </div>
      ) : null}

      <div className="detail-panel avail-panel">
        <div className="row-between avail-head">
          <h2 style={{ margin: 0 }}>Availability</h2>
          <div className="avail-controls">
            <div className="range-tabs" role="tablist" aria-label="Bar range">
              {DETAIL_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={range === r.id}
                  className={`range-tab${range === r.id ? ' on' : ''}`}
                  onClick={() => {
                    setRange(r.id)
                    setPicked(null)
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn tiny ghost"
              disabled={refreshing}
              onClick={() => void onRefreshBar()}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <p className="meta avail-meta">
          <span className="uptime-inline">
            10m {fmtPct(uptime?.['10m'])} · 1h {fmtPct(uptime?.['1h'])} · 1d {fmtPct(uptime?.['1d'])}{' '}
            · 1w {fmtPct(uptime?.['7d'])} · 30d {fmtPct(uptime?.['30d'])}
          </span>
          <span>
            · Last {fmtTime(monitor.last_checked_at)}
            {latest?.latency_ms != null ? ` · ${latest.latency_ms} ms` : ''}
            {picked
              ? ` · ${picked.success === true ? 'OK' : picked.success === false ? 'fail' : 'gap'}${picked.error_message ? ` (${picked.error_message})` : ''}`
              : ''}
          </span>
        </p>
        <HeartbeatBar status={monitor.status} results={results} onSelect={setPicked} />
      </div>

      <div className="detail-panel">
        <div className="row-between avail-head">
          <h2 style={{ margin: 0 }}>Public status</h2>
          <div className="avail-controls">
            {monitor.is_public ? (
              <button
                type="button"
                className="btn tiny ghost"
                disabled={shareBusy || confirmBusy}
                onClick={() => setConfirm('refresh-share')}
              >
                Refresh link
              </button>
            ) : null}
            <button
              type="button"
              className="btn tiny ghost"
              disabled={shareBusy}
              onClick={() => void onToggleShare()}
            >
              {monitor.is_public ? 'Turn off' : 'Share status'}
            </button>
          </div>
        </div>
        <p className="meta">
          Anyone with the link can see status and uptime — no login. Keys stay private.
        </p>
        {shareUrl ? (
          <div className="share-line">
            <code className="key-reveal">{shareUrl}</code>
            <button
              type="button"
              className="btn tiny ghost"
              onClick={() => void navigator.clipboard.writeText(shareUrl)}
            >
              Copy link
            </button>
            <a className="text-toggle" href={shareUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </div>
        ) : (
          <p className="meta">Sharing is off.</p>
        )}
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

      <div className="detail-panel" style={{ marginTop: '1.25rem' }}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>Recent checks</h2>
          <Link className="text-toggle" to={`/monitors/${monitor.id}/history?range=1d`}>
            Full history →
          </Link>
        </div>
        <p className="meta">Last day · 15 newest</p>
        {recentList.length > 0 ? (
          <ul className="check-list">
            {recentList.map((r) => (
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
        ) : (
          <p className="meta">No checks in the last day.</p>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete monitor?"
        body="This removes the monitor and its check history. This cannot be undone."
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />
      <ConfirmDialog
        open={confirm === 'rotate'}
        title="Rotate API key?"
        body="The current key stops working immediately. Copy the new key when it appears."
        confirmLabel="Rotate"
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />
      <ConfirmDialog
        open={confirm === 'refresh-share'}
        title="Refresh share link?"
        body="This creates a new public URL. Anyone with the old link will lose access immediately."
        confirmLabel="Refresh link"
        danger
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />
    </section>
  )
}
