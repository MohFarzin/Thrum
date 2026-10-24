type Props = {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'OK',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p className="meta">{body}</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn${danger ? ' danger' : ''}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
