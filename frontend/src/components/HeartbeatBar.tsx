import { useState, type CSSProperties } from 'react'
import type { BarSegment, MonitorStatus } from '../api/types'

type Tone = 'up' | 'warn' | 'down' | 'empty' | 'unknown'

type Seg = {
  tone: Tone
  segment?: BarSegment
  rate?: number | null
}

type Props = {
  status: MonitorStatus
  /** Newest-first time-aligned segments — always a full window. */
  results?: BarSegment[]
  interactive?: boolean
  onSelect?: (segment: BarSegment | null) => void
}

function toneOf(r: BarSegment): Tone {
  if (r.tone === 'empty' || r.success === null) return 'empty'
  if (r.tone === 'up' || r.tone === 'warn' || r.tone === 'down') return r.tone
  if (r.success) return 'up'
  return 'down'
}

function classify(results: BarSegment[] | undefined): Seg[] {
  if (!results || results.length === 0) return []
  return [...results].reverse().map((r) => ({
    tone: toneOf(r),
    segment: r,
    rate: r.success_rate ?? (r.success === true ? 1 : r.success === false ? 0 : null),
  }))
}

function tip(seg: Seg): string {
  const r = seg.segment
  if (!r || seg.tone === 'empty') {
    const when = r?.bucket_start ? new Date(r.bucket_start).toLocaleString() : ''
    return when ? `${when} · no data` : 'No data'
  }
  const start = r.bucket_start ? new Date(r.bucket_start).toLocaleString() : new Date(r.checked_at).toLocaleString()
  const parts = [start]
  if (r.error_message) parts.push(r.error_message)
  else if (r.success) parts.push('OK')
  else parts.push(seg.tone === 'warn' ? 'Soft fail' : 'Down')
  if (r.latency_ms != null) parts.push(`${r.latency_ms} ms`)
  return parts.join(' · ')
}

function segStyle(seg: Seg): CSSProperties | undefined {
  if (seg.tone !== 'up' || seg.rate == null) return undefined
  // 5/5 full green → 3/5 softer; keeps partial hours readable.
  const opacity = 0.45 + seg.rate * 0.55
  return { opacity }
}

/** Uptime bar — fixed slot count, floating tip (no layout jump). */
export function HeartbeatBar({
  status: _status,
  results,
  interactive = true,
  onSelect,
}: Props) {
  const segs = classify(results)
  const [hover, setHover] = useState<string | null>(null)

  if (segs.length === 0) {
    return (
      <div className="hb-wrap">
        <div className="hb-bar hb-bar-empty" role="img" aria-label="No availability data yet" />
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
              style={segStyle(seg)}
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
              style={segStyle(seg)}
              title={tip(seg)}
            />
          ),
        )}
      </div>
      {interactive && hover ? <div className="hb-float">{hover}</div> : null}
    </div>
  )
}
