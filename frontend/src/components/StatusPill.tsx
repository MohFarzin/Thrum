import type { MonitorStatus } from '../api/types'

const labels: Record<MonitorStatus, string> = {
  up: 'Up',
  down: 'Down',
  unknown: 'Unknown',
}

export function StatusPill({ status }: { status: MonitorStatus }) {
  return <span className={`status-pill status-pill-${status}`}>{labels[status]}</span>
}
