import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Circuit, Monitor, MonitorInput, MonitorType } from '../api/types'
import { useAuth } from '../hooks/useAuth'

const empty: MonitorInput = {
  name: '',
  type: 'http',
  target: '',
  circuits: [],
  interval_seconds: 60,
  timeout_seconds: 10,
  expected_status_code: 200,
  http_authorization: '',
  http_assert_link_ok: false,
  heartbeat_grace_seconds: 120,
  udp_payload: '',
  is_enabled: true,
}

const MAX_CIRCUITS = 3

const TYPES: { id: MonitorType; label: string; hint: string }[] = [
  { id: 'http', label: 'HTTP', hint: 'GET a URL' },
  { id: 'tcp', label: 'TCP', hint: 'Connect host:port' },
  { id: 'udp', label: 'UDP', hint: 'Datagram + reply' },
  { id: 'heartbeat', label: 'Heartbeat', hint: 'Agent push' },
]

function intervalFloor(type: MonitorType) {
  return type === 'tcp' || type === 'udp' ? 60 : 10
}

export function MonitorForm() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<MonitorInput>(empty)
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    void api<Circuit[]>('/api/circuits/')
      .then(setCircuits)
      .catch(() => setCircuits([]))
  }, [user])

  useEffect(() => {
    if (!user || !id) return
    api<Monitor>(`/api/monitors/${id}/`)
      .then((m) =>
        setForm({
          name: m.name,
          type: m.type,
          target: m.target,
          circuits: m.circuits || [],
          interval_seconds: m.interval_seconds,
          timeout_seconds: m.timeout_seconds,
          expected_status_code: m.expected_status_code,
          http_authorization: m.http_authorization_set ? '********' : '',
          http_assert_link_ok: Boolean(m.http_assert_link_ok),
          heartbeat_grace_seconds: m.heartbeat_grace_seconds,
          udp_payload: m.udp_payload || '',
          is_enabled: m.is_enabled,
        }),
      )
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [user, id])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  function set<K extends keyof MonitorInput>(key: K, value: MonitorInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function pickType(next: MonitorType) {
    setForm((prev) => {
      if (next === 'heartbeat') {
        return {
          ...prev,
          type: next,
          interval_seconds: Math.max(prev.interval_seconds, 30),
          heartbeat_grace_seconds: Math.max(prev.heartbeat_grace_seconds, 60),
        }
      }
      if (next === 'tcp' || next === 'udp') {
        return {
          ...prev,
          type: next,
          interval_seconds: Math.max(prev.interval_seconds, 60),
        }
      }
      return { ...prev, type: next }
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        ...form,
        target: form.type === 'heartbeat' ? form.target : form.target.trim(),
        interval_seconds: Math.max(intervalFloor(form.type), form.interval_seconds),
      }
      if (form.type !== 'http') {
        delete body.http_authorization
        delete body.http_assert_link_ok
      } else if (form.http_authorization === '********') {
        delete body.http_authorization
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

  const minInterval = intervalFloor(form.type)
  const cancelTo = editing && id ? `/monitors/${id}` : '/dashboard'

  return (
    <section className="page form-page">
      <Link className="back-link" to={cancelTo}>
        ← Back
      </Link>
      <div className="form-hero">
        <div>
          <p className="eyebrow">{editing ? 'Configure' : 'Create'}</p>
          <h1>{editing ? 'Edit monitor' : 'New monitor'}</h1>
          <p className="lede">Name the target, pick a check type, set the beat.</p>
        </div>
      </div>

      <form className="form-shell form-modern" onSubmit={onSubmit}>
        <fieldset className="form-block">
          <legend>Identity</legend>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="api-prod"
              required
            />
          </label>
          <fieldset className="circuit-pick">
            <legend className="field-legend">Circuits (up to {MAX_CIRCUITS})</legend>
            {circuits.length === 0 ? (
              <p className="meta">
                None yet. <Link to="/circuits">Create a circuit</Link> — leave empty to stay on Pulse.
              </p>
            ) : (
              <div className="circuit-check-grid">
                {circuits.map((c) => {
                  const on = form.circuits.includes(c.id)
                  const locked = !on && form.circuits.length >= MAX_CIRCUITS
                  return (
                    <label key={c.id} className={`circuit-check${on ? ' on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked}
                        onChange={() => {
                          if (on) {
                            set(
                              'circuits',
                              form.circuits.filter((id) => id !== c.id),
                            )
                          } else if (form.circuits.length < MAX_CIRCUITS) {
                            set('circuits', [...form.circuits, c.id])
                          }
                        }}
                      />
                      <span>{c.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <span className="field-hint">
              Empty = ungrouped (shows on Pulse). In a circuit = hidden from Pulse.
            </span>
          </fieldset>
        </fieldset>

        <fieldset className="form-block">
          <legend>Check type</legend>
          <div className="type-picker" role="radiogroup" aria-label="Monitor type">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={form.type === t.id}
                className={`type-pick${form.type === t.id ? ' on' : ''}`}
                onClick={() => pickType(t.id)}
              >
                <strong>{t.label}</strong>
                <span>{t.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="form-block">
          <legend>Target</legend>
          <label>
            {form.type === 'heartbeat' ? 'Label (optional)' : 'Address'}
            <input
              value={form.target}
              onChange={(e) => set('target', e.target.value)}
              placeholder={
                form.type === 'http'
                  ? 'https://example.com/health'
                  : form.type === 'tcp' || form.type === 'udp'
                    ? 'host.example.com:443'
                    : 'optional note'
              }
              required={form.type !== 'heartbeat'}
            />
          </label>
          {form.type === 'udp' ? (
            <>
              <div className="udp-presets" role="group" aria-label="UDP payload preset">
                <button
                  type="button"
                  className={`btn ghost tiny${form.udp_payload === '' ? ' on' : ''}`}
                  onClick={() => set('udp_payload', '')}
                >
                  Generic
                </button>
                <button
                  type="button"
                  className={`btn ghost tiny${form.udp_payload === 'bedrock' ? ' on' : ''}`}
                  onClick={() => set('udp_payload', 'bedrock')}
                >
                  Bedrock
                </button>
              </div>
              <label>
                UDP payload
                <input
                  value={form.udp_payload}
                  onChange={(e) => set('udp_payload', e.target.value)}
                  placeholder="Empty = short probe · bedrock = RakNet ping · hex:…"
                  maxLength={512}
                />
                <span className="field-hint">
                  Minecraft Bedrock: set payload to <code>bedrock</code> and target{' '}
                  <code>host:19132</code>. Up only if any reply arrives before timeout.
                </span>
              </label>
            </>
          ) : null}
          {form.type === 'http' ? (
            <>
              <label>
                Expected status
                <input
                  type="number"
                  value={form.expected_status_code}
                  onChange={(e) => set('expected_status_code', Number(e.target.value))}
                />
              </label>
              <label>
                Authorization header
                <input
                  value={form.http_authorization}
                  onChange={(e) => set('http_authorization', e.target.value)}
                  placeholder="Bearer … (optional)"
                  autoComplete="off"
                />
                <span className="field-hint">
                  Sent as HTTP Authorization. Leave as ******** to keep an existing secret.
                </span>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.http_assert_link_ok}
                  onChange={(e) => set('http_assert_link_ok', e.target.checked)}
                />
                <span className="switch-ui" aria-hidden />
                <span className="switch-copy">
                  <strong>Require link_ok</strong>
                  <span className="meta">JSON must include link_ok: true (WG / paired host)</span>
                </span>
              </label>
            </>
          ) : null}
        </fieldset>

        <fieldset className="form-block">
          <legend>Timing</legend>
          <div className="timing-grid">
            <label>
              Interval
              <div className="unit-field">
                <input
                  type="number"
                  min={minInterval}
                  value={form.interval_seconds}
                  onChange={(e) => set('interval_seconds', Number(e.target.value))}
                />
                <span>sec</span>
              </div>
              <span className="field-hint">
                {form.type === 'tcp' || form.type === 'udp'
                  ? 'Floor 60s for TCP/UDP'
                  : `Min ${minInterval}s`}
              </span>
            </label>
            {form.type !== 'heartbeat' ? (
              <label>
                Timeout
                <div className="unit-field">
                  <input
                    type="number"
                    min={1}
                    value={form.timeout_seconds}
                    onChange={(e) => set('timeout_seconds', Number(e.target.value))}
                  />
                  <span>sec</span>
                </div>
                <span className="field-hint">How long to wait for a reply</span>
              </label>
            ) : (
              <label>
                Grace
                <div className="unit-field">
                  <input
                    type="number"
                    min={10}
                    value={form.heartbeat_grace_seconds}
                    onChange={(e) => set('heartbeat_grace_seconds', Number(e.target.value))}
                  />
                  <span>sec</span>
                </div>
                <span className="field-hint">
                  Must POST within {form.interval_seconds + form.heartbeat_grace_seconds}s
                </span>
              </label>
            )}
          </div>
        </fieldset>

        <fieldset className="form-block form-block-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={(e) => set('is_enabled', e.target.checked)}
            />
            <span className="switch-ui" aria-hidden />
            <span className="switch-copy">
              <strong>Enabled</strong>
              <span className="meta">Run checks on the schedule</span>
            </span>
          </label>
        </fieldset>

        {error ? <p className="error">{error}</p> : null}

        <div className="form-actions">
          <button className="btn lg" type="submit" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create monitor'}
          </button>
          <Link className="btn ghost lg" to={cancelTo}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}
