import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Monitor } from '../api/types'
import { BrandMark } from '../components/BrandMark'
import { HeartbeatBar } from '../components/HeartbeatBar'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../hooks/useAuth'
import { withinWindow } from '../lib/ranges'

const DUMMY: Array<{
  name: string
  target: string
  status: Monitor['status']
  type: Monitor['type']
  downFrom?: number
}> = [
  { name: 'api', target: 'api.example.com', status: 'up', type: 'http', downFrom: 40 },
  { name: 'game-node', target: 'game-node:25565', status: 'down', type: 'tcp', downFrom: 36 },
]

function pickLandingMonitors(all: Monitor[]): Monitor[] {
  const favs = all
    .filter((m) => m.is_favorite)
    .sort((a, b) => {
      const ta = a.favorited_at ? Date.parse(a.favorited_at) : 0
      const tb = b.favorited_at ? Date.parse(b.favorited_at) : 0
      return tb - ta
    })
  if (favs.length > 0) return favs.slice(0, 6)
  return all.slice(0, 6)
}

export function Landing() {
  const { user, loading } = useAuth()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [favBusy, setFavBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setMonitors([])
      return
    }
    const load = () =>
      api<Monitor[]>('/api/monitors/')
        .then(setMonitors)
        .catch(() => setMonitors([]))
    void load()
    const t = window.setInterval(() => void load(), 20000)
    return () => window.clearInterval(t)
  }, [user])

  async function toggleFavorite(m: Monitor, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (favBusy) return
    setFavBusy(m.id)
    try {
      const updated = await api<Monitor>(`/api/monitors/${m.id}/favorite/`, {
        method: 'POST',
        body: JSON.stringify({ is_favorite: !m.is_favorite }),
      })
      setMonitors((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not update favorite')
    } finally {
      setFavBusy(null)
    }
  }

  const shown = user ? pickLandingMonitors(monitors) : []

  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="hero-brand-row">
          <BrandMark size={56} />
          <h1 className="brand">THRUM</h1>
        </div>
        <p className="tagline">If it has a pulse, THRUM hears it.</p>
        <p className="lede">
          Self-hosted uptime for HTTP, TCP, and agent heartbeats — status you can read at a
          glance, alerts when the beat skips.
        </p>
        <div className="actions">
          {user ? (
            <Link className="btn" to="/dashboard">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link className="btn" to="/register">
                Create account
              </Link>
              <Link className="btn ghost" to="/login">
                Log in
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="hero-preview">
        {loading ? (
          <p className="meta">Loading…</p>
        ) : user ? (
          shown.length === 0 ? (
            <div className="preview-card">
              <p className="meta" style={{ margin: 0 }}>
                No monitors yet. Star up to six from the dashboard to pin them here.
              </p>
              <div className="actions" style={{ marginTop: '0.85rem' }}>
                <Link className="btn tiny" to="/monitors/new">
                  Add monitor
                </Link>
              </div>
            </div>
          ) : (
            shown.map((m) => (
              <Link key={m.id} className="preview-card live" to={`/monitors/${m.id}`}>
                <div className="preview-head">
                  <div className="preview-title">
                    <StatusPill status={m.status} />
                    <span className="muted truncate">{m.name}</span>
                  </div>
                  <button
                    type="button"
                    className={`star-btn${m.is_favorite ? ' on' : ''}`}
                    aria-label={m.is_favorite ? 'Unfavorite' : 'Favorite'}
                    disabled={favBusy === m.id}
                    onClick={(e) => void toggleFavorite(m, e)}
                  >
                    ★
                  </button>
                </div>
                <HeartbeatBar
                  status={m.status}
                  results={withinWindow(m.recent_results, 60 * 60 * 1000)}
                  interactive={false}
                />
                <div className="preview-meta">
                  <span>1h · {m.target || m.type}</span>
                  <span className="type-chip">{m.type}</span>
                </div>
              </Link>
            ))
          )
        ) : (
          DUMMY.map((d) => (
            <div key={d.name} className={`preview-card${d.status === 'down' ? ' dim' : ''}`} aria-hidden>
              <div className="preview-head">
                <div className="preview-title">
                  <StatusPill status={d.status} />
                  <span className="muted">{d.target}</span>
                </div>
              </div>
              <div className="hb-bar dense">
                {Array.from({ length: 48 }, (_, i) => (
                  <span
                    key={i}
                    className={`hb-seg ${
                      d.downFrom != null && i >= d.downFrom
                        ? i === d.downFrom
                          ? 'hb-warn'
                          : 'hb-down'
                        : 'hb-up'
                    }`}
                  />
                ))}
              </div>
              <div className="preview-meta">
                <span>{d.status === 'up' ? 'demo · 1h' : 'demo · down'}</span>
                <span>{d.type.toUpperCase()}</span>
              </div>
            </div>
          ))
        )}
        {user && monitors.length > 6 && shown.length > 0 ? (
          <p className="meta landing-more">
            Showing {shown.length} pinned · <Link to="/monitors">view all</Link>
          </p>
        ) : null}
      </div>
    </section>
  )
}
