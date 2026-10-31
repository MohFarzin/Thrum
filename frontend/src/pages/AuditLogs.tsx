import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AuditEvent } from '../api/types'
import { useAuth } from '../hooks/useAuth'

export function AuditLogs() {
  const { user, loading } = useAuth()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    api<{ events: AuditEvent[]; visibility: string }>('/api/auth/audit/')
      .then((data) => setEvents(data.events || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [user])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  return (
    <section className="page">
      <div className="row-between">
        <div>
          <p className="eyebrow">Private</p>
          <h1>Audit log</h1>
          <p className="lede">
            Sign-ins, monitor changes, and status transitions. Not shown on public status pages.
          </p>
        </div>
        <a className="btn ghost" href="/api/auth/audit/?format=csv">
          Export CSV
        </a>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="log-panel">
        <div className="log-banner private">Private · only you</div>
        {events.length === 0 ? (
          <p className="meta empty-inline">No events yet.</p>
        ) : (
          <ul className="log-list">
            {events.map((e) => (
              <li key={e.id}>
                <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString()}</time>
                <span className="log-kind">{e.kind.replace(/_/g, ' ')}</span>
                <span className="log-msg">{e.message}</span>
                {e.monitor_id ? (
                  <Link className="log-link" to={`/monitors/${e.monitor_id}`}>
                    open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
