import { useState } from 'react'
import type { CheckResult, MonitorStatus } from '../api/types'

type Tone = 'up' | 'warn' | 'down' | 'unknown'

type Seg = {
  tone: Tone
  result?: CheckResult
}

type Props = {
  status: MonitorStatus
  segments?: number
  /** Newest-first results. When missing/empty → gray (no fake history). */
  results?: CheckResult[]
  /** Buttons + hover panel (detail page). Off inside card links. */
  interactive?: boolean
  onSelect?: (result: CheckResult | null) => void
}

function classify(results: CheckResult[] | undefined, segments: number): Seg[] {
  if (!results || results.length === 0) {
    return Array.from({ length: segments }, () => ({ tone: 'unknown' as const }))
  }
  const chronological = [...results].reverse().slice(-segments)
  const segs: Seg[] = []
  let streak = 0
  for (const r of chronological) {
    if (r.success) {
      streak = 0
      segs.push({ tone: 'up', result: r })
    } else {
      streak += 1
      segs.push({ tone: streak < 2 ? 'warn' : 'down', result: r })
    }
  }
  while (segs.length < segments) segs.unshift({ tone: 'unknown' })
  return segs
}

function tip(seg: Seg): string {
  if (!seg.result) return 'No check yet'
  const when = new Date(seg.result.checked_at).toLocaleString()
  const parts = [when]
  if (seg.result.success) {
    parts.push('OK')
    if (seg.result.latency_ms != null) parts.push(`${seg.result.latency_ms} ms`)
    if (seg.result.status_code != null) parts.push(`HTTP ${seg.result.status_code}`)
  } else {
    parts.push(seg.tone === 'warn' ? 'Soft fail' : 'Down')
    if (seg.result.latency_ms != null) parts.push(`${seg.result.latency_ms} ms`)
    if (seg.result.status_code != null) parts.push(`HTTP ${seg.result.status_code}`)
    if (seg.result.error_message) parts.push(seg.result.error_message)
  }
  return parts.join(' · ')
}

/** Uptime bar: green = ok, orange = first fail, red = confirmed fail (2+). */
export function HeartbeatBar({
  status: _status,
  segments = 40,
  results,
  interactive = true,
  onSelect,
}: Props) {
  const segs = classify(results, segments)
  const [hover, setHover] = useState<string | null>(null)

  return (
    <div className="hb-wrap">
      <div className="hb-bar" role="img" aria-label="Availability history">
        {segs.map((seg, i) =>
          interactive ? (
            <button
              key={i}
              type="button"
              className={`hb-seg hb-${seg.tone}${seg.result ? ' clickable' : ''}`}
              title={tip(seg)}
              aria-label={tip(seg)}
              onMouseEnter={() => setHover(tip(seg))}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(tip(seg))}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect?.(seg.result ?? null)
              }}
            />
          ) : (
            <span key={i} className={`hb-seg hb-${seg.tone}`} title={tip(seg)} />
          ),
        )}
      </div>
      {interactive && hover ? <p className="hb-tip meta">{hover}</p> : null}
    </div>
  )
}
