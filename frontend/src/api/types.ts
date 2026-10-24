export type User = {
  id: number
  username: string
  email: string
}

export type MonitorType = 'http' | 'tcp' | 'heartbeat'
export type MonitorStatus = 'up' | 'down' | 'unknown'

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
  interval_seconds: number
  timeout_seconds: number
  expected_status_code: number
  heartbeat_grace_seconds: number
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
  interval_seconds: number
  timeout_seconds: number
  expected_status_code: number
  heartbeat_grace_seconds: number
  is_enabled: boolean
}

export type AlertChannelType = 'email' | 'discord'

export type AlertChannel = {
  id: string
  name: string
  type: AlertChannelType
  config: Record<string, string>
  is_enabled: boolean
  created_at: string
  updated_at: string
}
