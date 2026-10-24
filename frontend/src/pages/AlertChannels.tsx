import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AlertChannel, AlertChannelType } from '../api/types'
import { useAuth } from '../hooks/useAuth'

export function AlertChannels() {
  const { user, loading } = useAuth()
  const [channels, setChannels] = useState<AlertChannel[]>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<AlertChannelType>('discord')
  const [to, setTo] = useState('')
  const [webhook, setWebhook] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [busy, setBusy] = useState(false)

  function reload() {
    return api<AlertChannel[]>('/api/alert-channels/')
      .then(setChannels)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }

  useEffect(() => {
    if (!user) return
    void reload()
  }, [user])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const config: Record<string, string | number | boolean> =
        type === 'discord'
          ? { webhook_url: webhook.trim() }
          : {
              to: to.trim(),
              smtp_host: smtpHost.trim(),
              smtp_port: Number(smtpPort) || 587,
              smtp_user: smtpUser.trim(),
              from_email: fromEmail.trim(),
              use_tls: true,
            }
      if (type === 'email' && smtpPassword.trim()) {
        config.smtp_password = smtpPassword.trim()
      }
      await api('/api/alert-channels/', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), type, config, is_enabled: true }),
      })
      setName('')
      setTo('')
      setWebhook('')
      setSmtpHost('')
      setSmtpUser('')
      setSmtpPassword('')
      setFromEmail('')
      setMsg('Channel saved.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this alert channel?')) return
    await api(`/api/alert-channels/${id}/`, { method: 'DELETE' })
    await reload()
  }

  async function toggle(ch: AlertChannel) {
    await api(`/api/alert-channels/${ch.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_enabled: !ch.is_enabled }),
    })
    await reload()
  }

  async function testChannel(ch: AlertChannel) {
    setError('')
    setMsg('')
    try {
      await api(`/api/alert-channels/${ch.id}/test/`, { method: 'POST' })
      setMsg(`Test sent via “${ch.name}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed')
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">Notifications</p>
      <h1>Alert channels</h1>
      <p className="lede">
        One message when a monitor goes down (after 2 failed checks), one when it recovers.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="meta">{msg}</p> : null}

      <div className="form-panel wide" style={{ marginTop: '1.5rem' }}>
        <h2>Add channel</h2>
        <form onSubmit={onCreate}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value as AlertChannelType)}>
              <option value="discord">Discord webhook</option>
              <option value="email">Email (SMTP)</option>
            </select>
          </label>
          {type === 'discord' ? (
            <label>
              Webhook URL
              <input
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/…"
                required
              />
            </label>
          ) : (
            <>
              <label>
                Send to
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <p className="meta">
                Fill SMTP below, or leave host empty to use server env (`EMAIL_HOST`).
              </p>
              <div className="grid-2">
                <label>
                  SMTP host
                  <input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </label>
                <label>
                  Port
                  <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
                </label>
              </div>
              <div className="grid-2">
                <label>
                  SMTP user
                  <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
                </label>
                <label>
                  SMTP password
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <label>
                From address
                <input
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="thrum@example.com"
                />
              </label>
            </>
          )}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Add channel'}
          </button>
        </form>
      </div>

      <div className="monitor-grid" style={{ marginTop: '1.5rem' }}>
        {channels.length === 0 ? (
          <div className="empty-card">
            <p>No channels yet. Discord is the fastest to verify.</p>
          </div>
        ) : (
          channels.map((ch) => (
            <article key={ch.id} className="monitor-card" style={{ cursor: 'default' }}>
              <div className="monitor-card-top">
                <div>
                  <h3>{ch.name}</h3>
                  <p className="muted truncate">
                    {ch.type === 'email'
                      ? `${ch.config.to || 'email'}${ch.config.smtp_host ? ` · ${ch.config.smtp_host}` : ''}`
                      : ch.config.webhook_url_set || ch.config.webhook_url === '********'
                        ? 'Discord webhook · set'
                        : 'Discord webhook'}
                  </p>
                </div>
                <span className="type-chip">{ch.type}</span>
              </div>
              <div className="monitor-card-foot">
                <button type="button" className="btn tiny" onClick={() => void testChannel(ch)}>
                  Send test
                </button>
                <button type="button" className="btn tiny ghost" onClick={() => void toggle(ch)}>
                  {ch.is_enabled ? 'Disable' : 'Enable'}
                </button>
                <button type="button" className="btn tiny danger" onClick={() => void onDelete(ch.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
