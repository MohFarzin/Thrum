import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AlertChannel, Circuit, Monitor } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'

const MAX_CIRCUITS = 3

export function CircuitEdit() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [circuit, setCircuit] = useState<Circuit | null>(null)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [channels, setChannels] = useState<AlertChannel[]>([])
  const [hookName, setHookName] = useState('Circuit Discord')
  const [webhook, setWebhook] = useState('')
  const [hookBusy, setHookBusy] = useState(false)
  const [showGraph, setShowGraph] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const [c, m, ch] = await Promise.all([
      api<Circuit>(`/api/circuits/${id}/`),
      api<Monitor[]>('/api/monitors/'),
      api<AlertChannel[]>(`/api/alert-channels/?circuit=${id}`),
    ])
    setCircuit(c)
    setName(c.name)
    setDescription(c.description || '')
    setShowGraph(Boolean(c.public_show_graph))
    setMonitors(m)
    setSelected(new Set(m.filter((x) => (x.circuits || []).includes(c.id)).map((x) => x.id)))
    setChannels(ch)
  }, [id])

  useEffect(() => {
    if (!user || !id) return
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [user, id, load])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (!circuit && !error) return <p className="meta">Loading…</p>
  if (!circuit) {
    return (
      <section className="page">
        <p className="error">{error || 'Not found'}</p>
        <Link to="/circuits">← Circuits</Link>
      </section>
    )
  }

  const shareUrl =
    circuit.is_public && circuit.public_slug
      ? `${window.location.origin}/c/${circuit.public_slug}`
      : null

  async function saveMeta() {
    if (!id) return
    setBusy(true)
    setError('')
    try {
      const updated = await api<Circuit>(`/api/circuits/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          monitor_ids: Array.from(selected),
        }),
      })
      setCircuit(updated)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleShare() {
    if (!id) return
    setShareBusy(true)
    setError('')
    try {
      const updated = await api<Circuit>(`/api/circuits/${id}/share/`, {
        method: 'POST',
        body: JSON.stringify({
          is_public: !circuit!.is_public,
          show_graph: showGraph,
        }),
      })
      setCircuit(updated)
      setShowGraph(Boolean(updated.public_show_graph))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share failed')
    } finally {
      setShareBusy(false)
    }
  }

  async function saveGraphFlag(next: boolean) {
    if (!id) return
    setShowGraph(next)
    setShareBusy(true)
    setError('')
    try {
      const updated = await api<Circuit>(`/api/circuits/${id}/share/`, {
        method: 'POST',
        body: JSON.stringify({ show_graph: next }),
      })
      setCircuit(updated)
      setShowGraph(Boolean(updated.public_show_graph))
    } catch (err) {
      setShowGraph(!next)
      setError(err instanceof Error ? err.message : 'Could not update graph setting')
    } finally {
      setShareBusy(false)
    }
  }

  async function rotateShare() {
    if (!id) return
    setShareBusy(true)
    setError('')
    try {
      const updated = await api<Circuit>(`/api/circuits/${id}/share/`, {
        method: 'POST',
        body: JSON.stringify({ rotate_slug: true, show_graph: showGraph }),
      })
      setCircuit(updated)
      setConfirmRotate(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotate failed')
    } finally {
      setShareBusy(false)
    }
  }

  async function doDelete() {
    if (!id) return
    setDeleteBusy(true)
    try {
      await api(`/api/circuits/${id}/`, { method: 'DELETE' })
      navigate('/circuits')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleteBusy(false)
      setConfirmDelete(false)
    }
  }

  function toggleMonitor(m: Monitor) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(m.id)) {
        next.delete(m.id)
        return next
      }
      const others = (m.circuits || []).filter((cid) => cid !== circuit!.id).length
      if (others >= MAX_CIRCUITS) {
        setError(`“${m.name}” already sits in ${MAX_CIRCUITS} circuits.`)
        return prev
      }
      next.add(m.id)
      return next
    })
  }

  async function addDiscord(e: FormEvent) {
    e.preventDefault()
    if (!id || !webhook.trim()) return
    setHookBusy(true)
    setError('')
    try {
      await api('/api/alert-channels/', {
        method: 'POST',
        body: JSON.stringify({
          name: hookName.trim() || 'Circuit Discord',
          type: 'discord',
          circuit: id,
          config: { webhook_url: webhook.trim() },
          is_enabled: true,
        }),
      })
      setWebhook('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discord save failed')
    } finally {
      setHookBusy(false)
    }
  }

  async function removeChannel(chId: string) {
    await api(`/api/alert-channels/${chId}/`, { method: 'DELETE' })
    await load()
  }

  async function testChannel(ch: AlertChannel) {
    setError('')
    try {
      await api(`/api/alert-channels/${ch.id}/test/`, { method: 'POST' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed')
    }
  }

  return (
    <section className="page">
      <Link className="back-link" to={`/circuits/${circuit.id}`}>
        ← Back to circuit
      </Link>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Edit</p>
          <h1>{circuit.name}</h1>
          <p className="lede">Name, description, pulses, Discord, and advanced share options.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="detail-panel">
        <h2 style={{ marginTop: 0 }}>Details</h2>
        <div className="form-shell" style={{ maxWidth: '40rem' }}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Shown on the circuit page and public link"
            />
          </label>
        </div>
      </div>

      <div className="detail-panel">
        <div className="row-between avail-head">
          <h2 style={{ margin: 0 }}>Pulses</h2>
          <span className="meta">{selected.size} selected · max {MAX_CIRCUITS} circuits / pulse</span>
        </div>
        {monitors.length === 0 ? (
          <p className="meta empty-inline">
            No monitors yet. <Link to="/monitors/new">Create one</Link>.
          </p>
        ) : (
          <ul className="circuit-member-list">
            {monitors.map((m) => {
              const others = (m.circuits || []).filter((cid) => cid !== circuit.id).length
              const atCap = !selected.has(m.id) && others >= MAX_CIRCUITS
              return (
                <li key={m.id}>
                  <label className="circuit-member">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      disabled={atCap}
                      onChange={() => toggleMonitor(m)}
                    />
                    <span className="circuit-member-name">{m.name}</span>
                    <span className={`type-badge ${m.type}`}>{m.type}</span>
                    <StatusPill status={m.status} />
                    {others > 0 ? (
                      <span className="meta">
                        +{others} other{others === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void saveMeta()}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="detail-panel">
        <div className="row-between avail-head">
          <h2 style={{ margin: 0 }}>Discord alerts</h2>
          <span className="meta">This circuit only</span>
        </div>
        {channels.length ? (
          <ul className="circuit-member-list">
            {channels.map((ch) => (
              <li key={ch.id}>
                <span className="circuit-member-name">{ch.name}</span>
                <div className="monitor-tile-actions">
                  <button type="button" className="btn ghost tiny" onClick={() => void testChannel(ch)}>
                    Test
                  </button>
                  <button
                    type="button"
                    className="btn ghost tiny danger"
                    onClick={() => void removeChannel(ch.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta empty-inline">No Discord webhook yet.</p>
        )}
        <form
          className="form-shell"
          style={{ marginTop: '1rem', maxWidth: '40rem' }}
          onSubmit={(e) => void addDiscord(e)}
        >
          <label>
            Label
            <input value={hookName} onChange={(e) => setHookName(e.target.value)} maxLength={200} />
          </label>
          <label>
            Discord webhook URL
            <input
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              type="url"
              required
            />
          </label>
          <button className="btn" type="submit" disabled={hookBusy || !webhook.trim()}>
            {hookBusy ? 'Saving…' : 'Add Discord webhook'}
          </button>
        </form>
      </div>

      <div className="detail-panel">
        <div className="row-between avail-head">
          <h2 style={{ margin: 0 }}>Advanced</h2>
          <span className="meta">Public share · delete</span>
        </div>
        <p className="meta">
          Public link shows pulse names and up/down. Tick “Share graph” to also show availability
          bars (10m / 1h / …). Unticked = status only.
        </p>
        <label className="switch" style={{ marginBottom: '0.85rem' }}>
          <input
            type="checkbox"
            checked={showGraph}
            disabled={shareBusy}
            onChange={(e) => void saveGraphFlag(e.target.checked)}
          />
          <span className="switch-ui" aria-hidden />
          <span className="switch-copy">
            <strong>Share graph</strong>
            <span className="meta">Include bars on the public page</span>
          </span>
        </label>
        <div className="avail-controls" style={{ marginBottom: '0.75rem' }}>
          {circuit.is_public ? (
            <button
              type="button"
              className="btn tiny ghost"
              disabled={shareBusy}
              onClick={() => setConfirmRotate(true)}
            >
              Refresh link
            </button>
          ) : null}
          <button
            type="button"
            className="btn tiny"
            disabled={shareBusy}
            onClick={() => void toggleShare()}
          >
            {circuit.is_public ? 'Turn off public' : 'Enable public share'}
          </button>
        </div>
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
          <p className="meta">Public sharing is off.</p>
        )}
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
            Delete circuit
          </button>
          <p className="meta" style={{ marginTop: '0.5rem' }}>
            Pulses stay — they only leave this circuit.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete circuit?"
        body={`Remove “${circuit.name}”? Monitors are kept.`}
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={() => void doDelete()}
        onCancel={() => {
          if (!deleteBusy) setConfirmDelete(false)
        }}
      />
      <ConfirmDialog
        open={confirmRotate}
        title="Refresh public link?"
        body="The old link stops working."
        confirmLabel="Refresh link"
        danger
        busy={shareBusy}
        onConfirm={() => void rotateShare()}
        onCancel={() => {
          if (!shareBusy) setConfirmRotate(false)
        }}
      />
    </section>
  )
}
