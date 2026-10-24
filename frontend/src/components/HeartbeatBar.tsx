import type { MonitorStatus } from '../api/types'

/** Uptime-Kuma-style segment bar (placeholder until real history exists). */
export function HeartbeatBar({ status, segments = 40 }: { status: MonitorStatus; segments?: number }) {
  return (
    <div className="hb-bar" aria-hidden>
      {Array.from({ length: segments }, (_, i) => {
        const tone =
          status === 'up' ? 'up' : status === 'down' ? (i > segments - 4 ? 'down' : 'up') : 'unknown'
        return <span key={i} className={`hb-seg hb-${tone}`} />
      })}
    </div>
  )
}
