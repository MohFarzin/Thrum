import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
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

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  async function onDelete() {
    if (!id || !confirm('Delete this monitor?')) return
    await api(`/api/monitors/${id}/`, { method: 'DELETE' })
    navigate('/monitors')
  }

  if (error) return <p className="error">{error}</p>
  if (!monitor) return <p className="meta">Loading…</p>

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
          <Link className="btn ghost" to={`/monitors/${monitor.id}/edit`}>
            Edit
          </Link>
          <button type="button" className="btn danger" onClick={() => void onDelete()}>
            Delete
          </button>
        </div>
      </div>

      <div className="detail-panel">
        <h2>Availability</h2>
        <HeartbeatBar status={monitor.status} segments={56} />
        <p className="meta">History bars fill in once Phase 2 checks are live.</p>
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
        <dd>{monitor.last_checked_at || '—'}</dd>
        <dt>Last heartbeat</dt>
        <dd>{monitor.last_heartbeat_at || '—'}</dd>
        <dt>Failures</dt>
        <dd>{monitor.consecutive_failures}</dd>
        <dt>Enabled</dt>
        <dd>{monitor.is_enabled ? 'Yes' : 'No'}</dd>
        <dt>ID</dt>
        <dd>
          <code>{monitor.id}</code>
        </dd>
      </dl>
    </section>
  )
}
