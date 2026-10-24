import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { useAuth } from '../hooks/useAuth'

export function MonitorsList() {
  const { user, loading } = useAuth()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    api<Monitor[]>('/api/monitors/')
      .then(setMonitors)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [user])

  if (loading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  return (
    <section>
      <div className="row-between">
        <h1>Monitors</h1>
        <Link className="btn" to="/monitors/new">
          New monitor
        </Link>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {monitors.length === 0 ? (
        <p className="meta">No monitors yet.</p>
      ) : (
        <ul className="monitor-list">
          {monitors.map((m) => (
            <li key={m.id}>
              <Link to={`/monitors/${m.id}`}>
                <span className={`dot status-${m.status}`} />
                <strong>{m.name}</strong>
                <span className="muted">{m.type}</span>
                <span className="muted">{m.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
