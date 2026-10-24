import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor, MonitorInput, MonitorType } from '../api/types'
import { useAuth } from '../hooks/useAuth'

const empty: MonitorInput = {
  name: '',
  type: 'http',
  target: '',
  interval_seconds: 60,
  timeout_seconds: 10,
  expected_status_code: 200,
  heartbeat_grace_seconds: 120,
  is_enabled: true,
}

export function MonitorForm() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<MonitorInput>(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    api<Monitor>(`/api/monitors/${id}/`)
      .then((m) =>
        setForm({
          name: m.name,
          type: m.type,
          target: m.target,
          interval_seconds: m.interval_seconds,
          timeout_seconds: m.timeout_seconds,
          expected_status_code: m.expected_status_code,
          heartbeat_grace_seconds: m.heartbeat_grace_seconds,
          is_enabled: m.is_enabled,
        }),
      )
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [user, id])

  if (loading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  function set<K extends keyof MonitorInput>(key: K, value: MonitorInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = {
        ...form,
        target: form.type === 'heartbeat' ? form.target : form.target.trim(),
      }
      if (editing && id) {
        await api(`/api/monitors/${id}/`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        navigate(`/monitors/${id}`)
      } else {
        const created = await api<Monitor>('/api/monitors/', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        navigate(`/monitors/${created.id}`, {
          state: created.api_key ? { apiKey: created.api_key } : undefined,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="form-panel wide page">
      <p className="eyebrow">{editing ? 'Update' : 'Create'}</p>
      <h1>{editing ? 'Edit monitor' : 'New monitor'}</h1>
      <form onSubmit={onSubmit}>
        <label>
          Name
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label>
          Type
          <select
            value={form.type}
            onChange={(e) => {
              const next = e.target.value as MonitorType
              setForm((prev) =>
                next === 'heartbeat'
                  ? {
                      ...prev,
                      type: next,
                      interval_seconds: Math.max(prev.interval_seconds, 30),
                      heartbeat_grace_seconds: Math.max(prev.heartbeat_grace_seconds, 60),
                    }
                  : { ...prev, type: next },
              )
            }}
          >
            <option value="http">HTTP</option>
            <option value="tcp">TCP</option>
            <option value="heartbeat">Heartbeat</option>
          </select>
        </label>
        <label>
          Target {form.type === 'heartbeat' ? '(optional)' : ''}
          <input
            value={form.target}
            onChange={(e) => set('target', e.target.value)}
            placeholder={
              form.type === 'http'
                ? 'https://example.com'
                : form.type === 'tcp'
                  ? 'example.com:443'
                  : ''
            }
            required={form.type !== 'heartbeat'}
          />
        </label>
        <div className="grid-2">
          <label>
            Interval (seconds)
            <input
              type="number"
              min={10}
              value={form.interval_seconds}
              onChange={(e) => set('interval_seconds', Number(e.target.value))}
            />
          </label>
          <label>
            Timeout (seconds)
            <input
              type="number"
              min={1}
              value={form.timeout_seconds}
              onChange={(e) => set('timeout_seconds', Number(e.target.value))}
            />
          </label>
        </div>
        {form.type === 'http' ? (
          <label>
            Expected status code
            <input
              type="number"
              value={form.expected_status_code}
              onChange={(e) => set('expected_status_code', Number(e.target.value))}
            />
          </label>
        ) : null}
        {form.type === 'heartbeat' ? (
          <>
            <label>
              Heartbeat grace (seconds)
              <input
                type="number"
                min={10}
                value={form.heartbeat_grace_seconds}
                onChange={(e) => set('heartbeat_grace_seconds', Number(e.target.value))}
              />
            </label>
            <p className="meta">
              Agents must POST at least every {form.interval_seconds + form.heartbeat_grace_seconds}s
              (interval + grace). One curl does not stay online forever — use a loop or Task Scheduler.
            </p>
          </>
        ) : null}
        <label className="check">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(e) => set('is_enabled', e.target.checked)}
          />
          Enabled
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <Link className="btn ghost" to={editing && id ? `/monitors/${id}` : '/monitors'}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}
