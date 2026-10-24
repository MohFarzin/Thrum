import { useEffect, useState } from 'react'
import './App.css'

type HealthState = 'loading' | 'ok' | 'error'

function App() {
  const [health, setHealth] = useState<HealthState>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/health/')
      .then((res) => {
        if (!res.ok) throw new Error('bad status')
        return res.json()
      })
      .then(() => {
        if (!cancelled) setHealth('ok')
      })
      .catch(() => {
        if (!cancelled) setHealth('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const label =
    health === 'loading'
      ? 'Checking API…'
      : health === 'ok'
        ? 'API healthy'
        : 'API unreachable (start Compose)'

  return (
    <main className="shell">
      <div className="panel">
        <h1 className="brand">THRUM</h1>
        <p className="tagline">If it has a pulse, THRUM hears it.</p>
        <div className="status">
          <span className={`dot ${health === 'ok' ? 'ok' : health === 'error' ? 'err' : ''}`} />
          <span>{label}</span>
        </div>
        <p className="meta">Phase 0 skeleton — monitors and alerts come next.</p>
      </div>
    </main>
  )
}

export default App
