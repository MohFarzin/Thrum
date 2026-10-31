import type { CSSProperties } from 'react'

export type HealthSlice = {
  range: string
  uptime_pct: number | null
  up_count: number
  down_count: number
  down_seconds: number
  down_human: string
}

type Props = {
  health: HealthSlice | null
  size?: number
  label?: string
}

/** Quiet SVG pie — colour on data only (up=accent, down=danger). */
export function UptimePie({ health, size = 160, label }: Props) {
  const up = health?.up_count ?? 0
  const down = health?.down_count ?? 0
  const total = up + down
  const pct = health?.uptime_pct
  const r = size / 2
  const stroke = Math.max(14, size * 0.14)
  const circ = 2 * Math.PI * (r - stroke / 2)
  const upFrac = total ? up / total : 0
  const downFrac = total ? down / total : 0

  const style = {
    ['--pie-size' as string]: `${size}px`,
  } as CSSProperties

  return (
    <div className="uptime-pie" style={style}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          pct == null ? 'No uptime data yet' : `Uptime ${pct}% · downtime ${health?.down_human ?? '—'}`
        }
      >
        <circle
          className="pie-track"
          cx={r}
          cy={r}
          r={r - stroke / 2}
          fill="none"
          strokeWidth={stroke}
        />
        {total === 0 ? null : (
          <>
            <circle
              className="pie-up"
              cx={r}
              cy={r}
              r={r - stroke / 2}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={`${upFrac * circ} ${circ}`}
              strokeDashoffset={0}
              transform={`rotate(-90 ${r} ${r})`}
            />
            <circle
              className="pie-down"
              cx={r}
              cy={r}
              r={r - stroke / 2}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={`${downFrac * circ} ${circ}`}
              strokeDashoffset={-upFrac * circ}
              transform={`rotate(-90 ${r} ${r})`}
            />
          </>
        )}
        <text x={r} y={r - 4} textAnchor="middle" className="pie-pct">
          {pct == null ? '—' : `${pct}%`}
        </text>
        <text x={r} y={r + 16} textAnchor="middle" className="pie-sub">
          uptime
        </text>
      </svg>
      <div className="pie-caption">
        {label ? <p className="meta">{label}</p> : null}
        <p className="pie-summary">
          {total === 0 ? (
            <>No checks in this range yet.</>
          ) : (
            <>
              <strong>{pct}%</strong> up · {up} ok / {down} fail · downtime{' '}
              <strong>{health?.down_human ?? '—'}</strong>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
