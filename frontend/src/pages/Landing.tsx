import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { useAuth } from '../hooks/useAuth'

export function Landing() {
  const { user } = useAuth()
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
      <div className="hero-preview" aria-hidden>
        <div className="preview-card">
          <div className="preview-head">
            <span className="status-pill status-pill-up">Up</span>
            <span className="muted">api.example.com</span>
          </div>
          <div className="hb-bar dense">
            {Array.from({ length: 48 }, (_, i) => (
              <span key={i} className={`hb-seg ${i === 40 ? 'hb-warn' : i > 40 ? 'hb-down' : 'hb-up'}`} />
            ))}
          </div>
          <div className="preview-meta">
            <span>24h · 100%</span>
            <span>42ms</span>
          </div>
        </div>
        <div className="preview-card dim">
          <div className="preview-head">
            <span className="status-pill status-pill-down">Down</span>
            <span className="muted">game-node:25565</span>
          </div>
          <div className="hb-bar dense">
            {Array.from({ length: 48 }, (_, i) => (
              <span key={i} className={`hb-seg ${i > 40 ? 'hb-down' : 'hb-up'}`} />
            ))}
          </div>
          <div className="preview-meta">
            <span>3m downtime</span>
            <span>TCP</span>
          </div>
        </div>
      </div>
    </section>
  )
}
