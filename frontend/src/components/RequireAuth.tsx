import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Logged-in users only. Unapproved members → /waiting. Staff always pass. */
export function RequireApproved({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.is_admin && !user.is_approved) {
    return <Navigate to="/waiting" replace />
  }
  return <>{children}</>
}

/** Staff/admin only — everyone else is bounced (no peek at /admin). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.is_admin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
