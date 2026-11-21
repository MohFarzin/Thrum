import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) {
    if (user.is_admin || user.is_approved) return <Navigate to="/dashboard" replace />
    return <Navigate to="/waiting" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(username, password, email)
      navigate('/waiting')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="form-panel">
      <p className="eyebrow">Get started</p>
      <h1>Create account</h1>
      <p className="meta">New accounts need admin approval before monitoring is unlocked.</p>
      <form onSubmit={onSubmit}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="[A-Za-z0-9_.\-]{3,32}"
            title="3–32 chars: letters, numbers, _ . -"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Email (optional)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="meta">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  )
}
