import type { CheckResult, MonitorStatus } from '../api/types'

type Props = {
  status: MonitorStatus
  segments?: number
  /** Newest-first results; used when present instead of status placeholder. */
  results?: CheckResult[]
}

/** Uptime-style segment bar from recent check results (oldest → newest left→right). */
export function HeartbeatBar({ status, segments = 40, results }: Props) {
  const tones: Array<'up' | 'down' | 'unknown'> = []
  if (results && results.length > 0) {
    const chronological = [...results].reverse().slice(-segments)
    for (const r of chronological) {
      tones.push(r.success ? 'up' : 'down')
    }
    while (tones.length < segments) {
      tones.unshift('unknown')
    }
  } else {
    for (let i = 0; i < segments; i++) {
      if (status === 'unknown') tones.push('unknown')
      else if (status === 'up') tones.push('up')
      else tones.push(i > segments - 4 ? 'down' : 'up')
    }
  }

  return (
    <div className="hb-bar" aria-hidden>
      {tones.map((tone, i) => (
        <span key={i} className={`hb-seg hb-${tone}`} />
      ))}
    </div>
  )
}
