import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { useAuth } from '../hooks/useAuth'

export function Dashboard() {
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

  const up = monitors.filter((m) => m.status === 'up').length
  const down = monitors.filter((m) => m.status === 'down').length
  const unknown = monitors.filter((m) => m.status === 'unknown').length

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="lede">Welcome, {user.username}.</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="stat-row">
        <div>
          <strong>{monitors.length}</strong>
          <span>monitors</span>
        </div>
        <div>
          <strong className="status-up">{up}</strong>
          <span>up</span>
        </div>
        <div>
          <strong className="status-down">{down}</strong>
          <span>down</span>
        </div>
        <div>
          <strong className="status-unknown">{unknown}</strong>
          <span>unknown</span>
        </div>
      </div>
      <p className="meta">Live checks land in Phase 2. Status stays unknown until then.</p>
      <Link className="btn" to="/monitors/new">
        Add monitor
      </Link>
    </section>
  )
}
