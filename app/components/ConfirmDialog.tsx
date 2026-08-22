'use client'

import { useRef, type ReactNode } from 'react'

/**
 * Dialog konfirmasi generik untuk aksi yang tidak bisa dibatalkan, seperti
 * menghapus. Dibangun di atas elemen <dialog> bawaan supaya dapat backdrop,
 * fokus terkunci, dan tombol Esc tanpa dependensi tambahan.
 */
export default function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  onConfirm,
  pending = false,
}: {
  trigger: (open: () => void) => ReactNode
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  pending?: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const open = () => dialogRef.current?.showModal()
  const close = () => dialogRef.current?.close()

  return (
    <>
      {trigger(open)}
      <dialog ref={dialogRef} className="confirm-dialog">
        <p className="confirm-dialog-title">{title}</p>
        {description ? <p className="confirm-dialog-desc">{description}</p> : null}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-quiet" onClick={close} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() => {
              close()
              onConfirm()
            }}
          >
            {pending ? '…' : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  )
}
