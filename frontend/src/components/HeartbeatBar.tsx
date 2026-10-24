import { useState, type CSSProperties } from 'react'
import type { BarSegment, MonitorStatus } from '../api/types'

type Tone = 'up' | 'warn' | 'down' | 'empty' | 'unknown'

type Seg = {
  tone: Tone
  segment?: BarSegment
  age?: number
}

type Props = {
  status: MonitorStatus
  /** Newest-first time-aligned segments (or raw checks). No left-padding. */
  results?: BarSegment[]
  interactive?: boolean
  ageFade?: boolean
  onSelect?: (segment: BarSegment | null) => void
}

function toneOf(r: BarSegment, streak: number): Tone {
  if (r.tone === 'empty' || r.success === null) return 'empty'
  if (r.tone === 'up' || r.tone === 'warn' || r.tone === 'down') return r.tone
  if (r.success) return 'up'
  return streak < 2 ? 'warn' : 'down'
}

function classify(results: BarSegment[] | undefined): Seg[] {
  if (!results || results.length === 0) return []
  // Results are newest-first; paint oldest → newest left → right.
  const chronological = [...results].reverse()
  const segs: Seg[] = []
  let streak = 0
  const n = chronological.length
  for (let i = 0; i < chronological.length; i++) {
    const r = chronological[i]
    const age = n <= 1 ? 0 : 1 - i / (n - 1)
    if (r.success === true) streak = 0
    else if (r.success === false) streak += 1
    segs.push({ tone: toneOf(r, streak), segment: r, age })
  }
  return segs
}

function tip(seg: Seg): string {
  const r = seg.segment
  if (!r || seg.tone === 'empty') {
    if (r?.bucket_start) {
      return `${new Date(r.bucket_start).toLocaleString()} · no data`
    }
    return 'No data'
  }
  const when = new Date(r.checked_at).toLocaleString()
  const parts = [when]
  if (r.success) {
    parts.push('OK')
    if (r.latency_ms != null) parts.push(`${r.latency_ms} ms`)
    if (r.status_code != null) parts.push(`HTTP ${r.status_code}`)
  } else {
    parts.push(seg.tone === 'warn' ? 'Soft fail' : 'Down')
    if (r.latency_ms != null) parts.push(`${r.latency_ms} ms`)
    if (r.status_code != null) parts.push(`HTTP ${r.status_code}`)
    if (r.error_message) parts.push(r.error_message)
  }
  return parts.join(' · ')
}

function ageStyle(age: number | undefined, fade: boolean): CSSProperties | undefined {
  if (!fade || age == null) return undefined
  return { opacity: 0.4 + (1 - age) * 0.6 }
}

/** Uptime bar — only real time slots; never pads with fake “not checked” blocks. */
export function HeartbeatBar({
  status: _status,
  results,
  interactive = true,
  ageFade = false,
  onSelect,
}: Props) {
  const segs = classify(results)
  const [hover, setHover] = useState<string | null>(null)

  if (segs.length === 0) {
    return (
      <div className="hb-wrap">
        <div className="hb-bar hb-bar-empty" role="img" aria-label="No availability data yet" />
        {interactive ? <p className="hb-tip meta">&nbsp;</p> : null}
      </div>
    )
  }

  return (
    <div className="hb-wrap">
      <div className="hb-bar" role="img" aria-label="Availability history">
        {segs.map((seg, i) =>
          interactive ? (
            <button
              key={i}
              type="button"
              className={`hb-seg hb-${seg.tone}${seg.tone !== 'empty' ? ' clickable' : ''}`}
              style={ageStyle(seg.age, ageFade)}
              title={tip(seg)}
              aria-label={tip(seg)}
              onMouseEnter={() => setHover(tip(seg))}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(tip(seg))}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect?.(seg.segment ?? null)
              }}
            />
          ) : (
            <span
              key={i}
              className={`hb-seg hb-${seg.tone}`}
              style={ageStyle(seg.age, ageFade)}
              title={tip(seg)}
            />
          ),
        )}
      </div>
      {/* Always reserve tip height — avoids layout jump on hover. */}
      {interactive ? <p className="hb-tip meta">{hover || '\u00a0'}</p> : null}
    </div>
  )
}
