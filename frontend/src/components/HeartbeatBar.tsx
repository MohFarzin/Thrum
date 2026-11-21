import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { BarSegment, MonitorStatus } from '../api/types'

type Tone = 'up' | 'warn' | 'down' | 'empty' | 'unknown'

type Seg = {
  tone: Tone
  segment?: BarSegment
  rate?: number | null
  tip: string
}

type Props = {
  status: MonitorStatus
  /** Newest-first time-aligned segments — always a full window. */
  results?: BarSegment[]
  /** When true, segments are clickable (detail select). Tips always show. */
  interactive?: boolean
  onSelect?: (segment: BarSegment | null) => void
}

const TIP_HOLD_MS = 3000

function toneOf(r: BarSegment): Tone {
  if (r.tone === 'empty' || r.success === null) return 'empty'
  if (r.tone === 'up' || r.tone === 'warn' || r.tone === 'down') return r.tone
  if (r.success) return 'up'
  return 'down'
}

function tipFor(r: BarSegment, tone: Tone): string {
  if (tone === 'empty' || r.success === null) {
    const when = r.bucket_start ? new Date(r.bucket_start).toLocaleString() : ''
    return when ? `${when} · no data` : 'No data'
  }
  const start = r.bucket_start
    ? new Date(r.bucket_start).toLocaleString()
    : new Date(r.checked_at).toLocaleString()
  const parts = [start]
  if (r.error_message) parts.push(r.error_message)
  else if (r.success) parts.push('OK')
  else parts.push(tone === 'warn' ? 'Soft fail' : 'Down')
  if (r.latency_ms != null) parts.push(`${r.latency_ms} ms`)
  return parts.join(' · ')
}

function classify(results: BarSegment[] | undefined): Seg[] {
  if (!results || results.length === 0) return []
  return [...results].reverse().map((r) => {
    const tone = toneOf(r)
    return {
      tone,
      segment: r,
      rate: r.success_rate ?? (r.success === true ? 1 : r.success === false ? 0 : null),
      tip: tipFor(r, tone),
    }
  })
}

function segStyle(seg: Seg): CSSProperties | undefined {
  if (seg.tone !== 'up' || seg.rate == null) return undefined
  const opacity = 0.45 + seg.rate * 0.55
  return { opacity }
}

/** Uptime bar — fixed slot count, floating tip reused in place (no close/reopen flicker). */
export function HeartbeatBar({
  status: _status,
  results,
  interactive = true,
  onSelect,
}: Props) {
  const segs = classify(results)
  const [tip, setTip] = useState<string | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearHide() {
    if (hideTimer.current != null) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  function showTip(text: string, e?: PointerEvent) {
    if (e && e.pointerType === 'touch') return
    clearHide()
    // Update text in place — never unmount between neighboring slots.
    setTip(text)
  }

  function scheduleHide() {
    clearHide()
    hideTimer.current = setTimeout(() => {
      setTip(null)
      hideTimer.current = null
    }, TIP_HOLD_MS)
  }

  useEffect(() => () => clearHide(), [])

  if (segs.length === 0) {
    return (
      <div className="hb-wrap">
        <div className="hb-bar hb-bar-empty" role="img" aria-label="No availability data yet" />
      </div>
    )
  }

  return (
    <div className="hb-wrap">
      <div
        className="hb-bar"
        role="img"
        aria-label="Availability history"
        onPointerLeave={scheduleHide}
      >
        {segs.map((seg, i) =>
          interactive ? (
            <button
              key={i}
              type="button"
              className={`hb-seg hb-${seg.tone}${seg.tone !== 'empty' ? ' clickable' : ''}`}
              style={segStyle(seg)}
              aria-label={seg.tip}
              onPointerEnter={(e) => showTip(seg.tip, e)}
              onFocus={() => showTip(seg.tip)}
              onBlur={scheduleHide}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect?.(seg.segment ?? null)
              }}
            />
          ) : (
            <span
              key={i}
              className={`hb-seg hb-${seg.tone} hb-tippy`}
              style={segStyle(seg)}
              aria-label={seg.tip}
              onPointerEnter={(e) => showTip(seg.tip, e)}
            />
          ),
        )}
      </div>
      {tip != null ? <div className="hb-float">{tip}</div> : null}
    </div>
  )
}
