export type User = {
  id: number
  username: string
  email: string
}

export type MonitorType = 'http' | 'tcp' | 'heartbeat'
export type MonitorStatus = 'up' | 'down' | 'unknown'

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

export type CheckResult = {
  id: number
  checked_at: string
  success: boolean
  latency_ms: number | null
  error_message: string
  status_code: number | null
}
