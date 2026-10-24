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
