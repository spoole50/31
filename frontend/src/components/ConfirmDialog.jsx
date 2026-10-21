/**
 * Yes/no confirmation for actions that can't be undone (leaving a game).
 * Focus starts on the safe choice.
 */

import { useId } from 'react'
import Modal from './Modal.jsx'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const titleId = useId()
  return (
    <Modal open={open} onClose={onCancel} labelledBy={titleId}>
      <h2 id={titleId} className="text-xl font-bold mb-2">{title}</h2>
      {message && <p className="text-white/70 text-sm mb-6">{message}</p>}
      <div className="flex gap-3">
        <button className="btn btn-secondary flex-1" onClick={onCancel} data-autofocus>
          {cancelLabel}
        </button>
        <button className="btn btn-danger flex-1" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
