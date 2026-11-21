import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Circuit } from '../api/types'
import { UptimePie } from '../components/UptimePie'
import { useAuth } from '../hooks/useAuth'

const RANGES = [
  { id: '1h', label: '1h' },
  { id: '1d', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
] as const

export function Circuits() {
  const { user, loading } = useAuth()
  const [rows, setRows] = useState<Circuit[]>([])
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('1d')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = () =>
      void api<Circuit[]>(`/api/circuits/?range=${range}`)
        .then(setRows)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
    load()
    const t = window.setInterval(load, 30000)
    return () => window.clearInterval(t)
  }, [user, range])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      const created = await api<Circuit>('/api/circuits/', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      })
      setName('')
      setDescription('')
      setCreating(false)
      setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? range

  return (
    <section className="page">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Circuits</p>
          <h1>Circuits</h1>
          <p className="lede">
            Named clusters of pulses. Each circuit has its own pie, Discord alerts, and optional
            public stats. Ungrouped pulses stay on Pulse.
          </p>
        </div>
        <div className="actions">
          <div className="range-tabs" role="tablist" aria-label="Circuit range">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={range === r.id}
                className={`range-tab${range === r.id ? ' on' : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {!creating ? (
            <button type="button" className="btn" onClick={() => setCreating(true)}>
              New circuit
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      {creating ? (
        <form className="circuit-create-panel" onSubmit={(e) => void onCreate(e)}>
          <div className="circuit-create-head">
            <h2>New circuit</h2>
            <button
              type="button"
              className="btn ghost tiny"
              onClick={() => {
                setCreating(false)
                setName('')
                setDescription('')
              }}
            >
              Cancel
            </button>
          </div>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Edge, Game fleet, Bedrock"
              maxLength={200}
              required
              autoFocus
            />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — shown on the public page"
              maxLength={500}
            />
          </label>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create circuit'}
            </button>
          </div>
        </form>
      ) : null}

      {rows.length === 0 && !creating ? (
        <div className="empty-card">
          <p>No circuits yet. Create one, then attach up to three circuits per pulse.</p>
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            New circuit
          </button>
        </div>
      ) : (
        <div className="circuit-grid">
          {rows.map((c) => (
            <Link key={c.id} to={`/circuits/${c.id}`} className="circuit-card">
              <header className="circuit-card-head">
                <div>
                  <h2 className="circuit-card-title">{c.name || 'Untitled'}</h2>
                  {c.description ? <p className="meta truncate">{c.description}</p> : null}
                </div>
                {c.is_public ? <span className="share-chip">public</span> : null}
              </header>
              <div className="circuit-card-body">
                <UptimePie health={c.health} size={96} label={rangeLabel} compact />
                <dl className="circuit-card-stats">
                  <div>
                    <dt>Pulses</dt>
                    <dd>{c.monitor_count}</dd>
                  </div>
                  <div>
                    <dt>Up</dt>
                    <dd className={c.up_now ? 'up' : undefined}>{c.up_now}</dd>
                  </div>
                  <div>
                    <dt>Down</dt>
                    <dd className={c.down_now ? 'down' : undefined}>{c.down_now}</dd>
                  </div>
                  <div>
                    <dt>{rangeLabel}</dt>
                    <dd>
                      {c.health.uptime_pct != null ? `${c.health.uptime_pct}%` : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
