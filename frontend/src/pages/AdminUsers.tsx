import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminUser } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../hooks/useAuth'

type ListPayload = { users: AdminUser[]; pending_count: number }

export function AdminUsers() {
  const { user, loading } = useAuth()
  const [rows, setRows] = useState<AdminUser[]>([])
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pwDraft, setPwDraft] = useState<Record<number, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    const data = await api<ListPayload>('/api/auth/admin/users/')
    setRows(data.users || [])
    setPending(data.pending_count || 0)
  }, [])

  useEffect(() => {
    if (!user?.is_admin) return
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [user, load])

  if (loading) return <p className="meta">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/dashboard" replace />

  async function run(id: number, fn: () => Promise<void>) {
    setBusyId(id)
    setError('')
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setError('')
    try {
      await api(`/api/auth/admin/users/${deleteTarget.id}/delete/`, { method: 'POST' })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <section className="page">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Staff</p>
          <h1>Admin</h1>
          <p className="lede">
            Approve members, reset passwords, and manage access. {pending} waiting.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const waiting = !u.is_admin && !u.is_approved
              const approved = u.is_admin || u.is_approved
              return (
                <tr key={u.id} className={waiting ? 'is-pending' : undefined}>
                  <td className="mono">{u.id}</td>
                  <td>
                    <div className="admin-user-cell">
                      <strong>{u.username}</strong>
                      {u.is_admin ? <span className="admin-badge">admin</span> : null}
                      {!u.is_active ? <span className="meta">disabled</span> : null}
                      <span className="meta mono truncate">{u.email || '—'}</span>
                    </div>
                  </td>
                  <td>
                    {approved ? (
                      <span className="status-pill status-pill-up">Approved</span>
                    ) : (
                      <span className="status-pill status-pill-unknown">Pending</span>
                    )}
                  </td>
                  <td className="mono meta">
                    {u.date_joined ? new Date(u.date_joined).toLocaleString() : '—'}
                  </td>
                  <td>
                    <div className="admin-pw">
                      <input
                        type="password"
                        placeholder="New password"
                        value={pwDraft[u.id] || ''}
                        onChange={(e) =>
                          setPwDraft((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        minLength={8}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="btn ghost tiny"
                        disabled={busyId === u.id || !(pwDraft[u.id] || '').trim()}
                        onClick={() =>
                          void run(u.id, async () => {
                            await api(`/api/auth/admin/users/${u.id}/set-password/`, {
                              method: 'POST',
                              body: JSON.stringify({ password: pwDraft[u.id] }),
                            })
                            setPwDraft((prev) => ({ ...prev, [u.id]: '' }))
                          })
                        }
                      >
                        Set
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {waiting ? (
                        <button
                          type="button"
                          className="btn tiny"
                          disabled={busyId === u.id}
                          onClick={() =>
                            void run(u.id, async () => {
                              await api(`/api/auth/admin/users/${u.id}/approve/`, {
                                method: 'POST',
                              })
                            })
                          }
                        >
                          Approve
                        </button>
                      ) : null}
                      {approved && u.id !== user.id ? (
                        <button
                          type="button"
                          className="btn ghost tiny danger"
                          disabled={busyId === u.id || deleteBusy}
                          onClick={() => setDeleteTarget(u)}
                        >
                          Delete
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn ghost tiny"
                        disabled={busyId === u.id || u.id === user.id}
                        onClick={() =>
                          void run(u.id, async () => {
                            await api(`/api/auth/admin/users/${u.id}/`, {
                              method: 'PATCH',
                              body: JSON.stringify({ is_active: !u.is_active }),
                            })
                          })
                        }
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="meta empty-inline">No users yet.</p> : null}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete user?"
        body={
          deleteTarget
            ? `Permanently delete “${deleteTarget.username}” (ID ${deleteTarget.id}) and all of their monitors? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null)
        }}
      />
    </section>
  )
}
