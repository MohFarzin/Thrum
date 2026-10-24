import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { useAuth } from '../hooks/useAuth'

export function MonitorDetail() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !id) return
    api<Monitor>(`/api/monitors/${id}/`)
      .then(setMonitor)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [user, id])

  if (loading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  async function onDelete() {
    if (!id || !confirm('Delete this monitor?')) return
    await api(`/api/monitors/${id}/`, { method: 'DELETE' })
    navigate('/monitors')
  }

  if (error) return <p className="error">{error}</p>
  if (!monitor) return <p>Loading…</p>

  return (
    <section>
      <div className="row-between">
        <h1>{monitor.name}</h1>
        <div className="actions">
          <Link className="btn ghost" to={`/monitors/${monitor.id}/edit`}>
            Edit
          </Link>
          <button type="button" className="btn danger" onClick={() => void onDelete()}>
            Delete
          </button>
        </div>
      </div>
      <p>
        <span className={`dot status-${monitor.status}`} />
        <strong className={`status-${monitor.status}`}>{monitor.status}</strong>
        <span className="muted"> · {monitor.type}</span>
        {!monitor.is_enabled ? <span className="muted"> · disabled</span> : null}
      </p>
      <dl className="detail-grid">
        <dt>Target</dt>
        <dd>{monitor.target || '—'}</dd>
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
        <dd>{monitor.last_checked_at || '—'}</dd>
        <dt>Last heartbeat</dt>
        <dd>{monitor.last_heartbeat_at || '—'}</dd>
        <dt>Failures</dt>
        <dd>{monitor.consecutive_failures}</dd>
        <dt>ID</dt>
        <dd>
          <code>{monitor.id}</code>
        </dd>
      </dl>
      <p className="meta">
        Checks and API keys arrive in later phases. This page is the CRUD shell.
      </p>
      <Link to="/monitors">← Back to monitors</Link>
    </section>
  )
}
