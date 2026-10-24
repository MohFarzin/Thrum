function formatError(data: unknown, status: number): string {
  if (typeof data === 'string' && data) return data
  if (!data || typeof data !== 'object') return `Request failed (${status})`
  const obj = data as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  if (Array.isArray(obj.non_field_errors) && obj.non_field_errors[0]) {
    return String(obj.non_field_errors[0])
  }
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val) && val[0]) return `${key}: ${String(val[0])}`
    if (typeof val === 'string') return `${key}: ${val}`
  }
  return `Request failed (${status})`
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export async function ensureCsrf(): Promise<string> {
  const existing = getCookie('csrftoken')
  if (existing) return existing
  const res = await fetch('/api/auth/csrf/', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to get CSRF token')
  const data = (await res.json()) as { csrfToken: string }
  return data.csrfToken || getCookie('csrftoken') || ''
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = await ensureCsrf()
    if (csrf) headers.set('X-CSRFToken', csrf)
  }
  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    throw new Error(formatError(data, res.status))
  }
  return data as T
}
