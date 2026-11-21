export type User = {
  id: number
  username: string
  email: string
  is_approved: boolean
  is_staff: boolean
  /** True when Django is_staff — admin console + badge. */
  is_admin: boolean
  is_active: boolean
  date_joined?: string
}

export type AdminUser = User & {
  last_login: string | null
}

export type MonitorType = 'http' | 'tcp' | 'udp' | 'heartbeat'
export type MonitorStatus = 'up' | 'down' | 'unknown'

export type HealthSlice = {
  range: string
  uptime_pct: number | null
  up_count: number
  down_count: number
  down_seconds: number
  down_human: string
}

export type Incident = {
  started_at: string
  ended_at: string
  duration_seconds: number
  duration_human: string
  error_message: string
}

export type AuditEvent = {
  id: number
  kind: string
  message: string
  monitor_id: string | null
  created_at: string
}

export type CheckResult = {
  id: number
  checked_at: string
  success: boolean
  latency_ms: number | null
  error_message: string
  status_code: number | null
}

/** Time-aligned bar slot (from /results/?range=…). success null = empty gap. */
export type BarSegment = {
  id: number
  checked_at: string
  success: boolean | null
  latency_ms: number | null
  error_message: string
  status_code: number | null
  tone?: 'up' | 'warn' | 'down' | 'empty'
  /** 0..1 share of checks OK in this slot (for green strength). */
  success_rate?: number | null
  bucket_start?: string
  bucket_end?: string
}

export type UptimeSummary = {
  '10m': number | null
  '1h': number | null
  '1d': number | null
  '7d': number | null
  '30d': number | null
}

export type Monitor = {
  id: string
  name: string
  type: MonitorType
  target: string
  /** Up to 3 circuits this pulse belongs to. Empty = ungrouped (Pulse list). */
  circuits: string[]
  interval_seconds: number
  timeout_seconds: number
  expected_status_code: number
  /** True when an Authorization header is stored (value never returned). */
  http_authorization_set?: boolean
  http_assert_link_ok: boolean
  heartbeat_grace_seconds: number
  udp_payload: string
  status: MonitorStatus
  last_checked_at: string | null
  last_heartbeat_at: string | null
  consecutive_failures: number
  is_enabled: boolean
  is_favorite: boolean
  favorited_at: string | null
  is_public: boolean
  public_slug: string | null
  created_at: string
  updated_at: string
  api_key_prefix: string
  /** Present only once on create / rotate — never stored client-side permanently. */
  api_key?: string
  /** Newest-first; used for list/dashboard bars. */
  recent_results?: CheckResult[]
}

export type MonitorInput = {
  name: string
  type: MonitorType
  target: string
  circuits: string[]
  interval_seconds: number
  timeout_seconds: number
  expected_status_code: number
  http_authorization: string
  http_assert_link_ok: boolean
  heartbeat_grace_seconds: number
  udp_payload: string
  is_enabled: boolean
}

/** Named cluster of monitors — dashboard pies + optional public stats. */
export type Circuit = {
  id: string
  name: string
  description: string
  sort_order: number
  is_public: boolean
  public_slug: string | null
  /** When public: include per-pulse bars; else status only. */
  public_show_graph: boolean
  monitor_count: number
  up_now: number
  down_now: number
  unknown_now: number
  health: HealthSlice
  created_at: string
  updated_at: string
}

export type AlertChannelType = 'email' | 'discord'

export type AlertChannel = {
  id: string
  name: string
  type: AlertChannelType
  /** Null on main Alerts page; set for circuit Discord webhooks. */
  circuit: string | null
  config: Record<string, string | boolean | number>
  is_enabled: boolean
  created_at: string
  updated_at: string
}
