import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Landing() {
  const { user } = useAuth()
  return (
    <section className="hero-panel">
      <h1 className="brand">THRUM</h1>
      <p className="tagline">If it has a pulse, THRUM hears it.</p>
      <p className="lede">
        Self-hosted heartbeat monitoring — HTTP, TCP, and agent heartbeats.
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
    </section>
  )
}
