'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import {
  deleteTransaction,
  updateTransaction,
  type ActionResult,
} from '@/app/actions/transactions'
import ConfirmDialog from './ConfirmDialog'
import MoneyInput from './MoneyInput'
import { formatRupiah, formatShortDate } from '@/lib/core/format'

export type TransactionView = {
  id: string
  kind: 'IN' | 'OUT'
  amount: number
  dateLocal: string
  description: string | null
  source: 'manual' | 'fixed_cost'
  categoryId: string | null
  categoryName: string | null
}

export type CategoryOption = { id: string; name: string }

export default function TransactionRow({
  transaction,
  categories = [],
  showDate = false,
}: {
  transaction: TransactionView
  categories?: CategoryOption[]
  showDate?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const deleteFormRef = useRef<HTMLFormElement>(null)

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => deleteTransaction(formData),
    null,
  )
  const [editState, editAction, editPending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => updateTransaction(formData),
    null,
  )

  useEffect(() => {
    if (editState?.ok) setEditing(false)
  }, [editState])

  const meta = [
    showDate ? formatShortDate(transaction.dateLocal) : null,
    transaction.categoryName,
    transaction.source === 'fixed_cost' ? 'Tagihan rutin' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (editing) {
    return (
      <li className="tx-row tx-row-editing">
        <form action={editAction} className="row-editor">
          <input type="hidden" name="id" value={transaction.id} />

          <div className="form-grid">
            <label>
              Jumlah
              <MoneyInput name="amount" defaultValue={transaction.amount} required />
            </label>

            <label>
              Tanggal
              <input type="date" name="date_local" defaultValue={transaction.dateLocal} />
            </label>

            {/* Pemasukan tidak berkategori, jadi fieldnya tidak ditawarkan sama
                sekali — form tanpa field ini mengirim kategori kosong, dan itu
                memang nilai yang benar untuk pemasukan. */}
            {transaction.kind === 'OUT' ? (
              <label>
                Kategori
                <select name="category_id" defaultValue={transaction.categoryId ?? ''}>
                  <option value="">Tanpa kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Keterangan
              <input
                name="description"
                defaultValue={transaction.description ?? ''}
                placeholder="Boleh dikosongkan"
              />
            </label>
          </div>

          <div className="row-editor-actions">
            <button type="submit" className="btn" disabled={editPending}>
              {editPending ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setEditing(false)}
              disabled={editPending}
            >
              Batal
            </button>
          </div>

          {editState && !editState.ok ? (
            <p className="alert-error">{editState.error}</p>
          ) : null}
        </form>
      </li>
    )
  }

  return (
    <li className="tx-row">
      <div className="tx-main">
        <p className="tx-title">{transaction.description ?? 'Tanpa keterangan'}</p>
        {meta ? <p className="tx-meta">{meta}</p> : null}
        {deleteState && !deleteState.ok ? (
          <p className="alert-error">{deleteState.error}</p>
        ) : null}
      </div>

      <span className={transaction.kind === 'IN' ? 'tx-amount pill-in' : 'tx-amount'}>
        {transaction.kind === 'IN' ? '+' : '−'}
        {formatRupiah(transaction.amount)}
      </span>

      <div className="tx-actions">
        {/* Pembayaran tagihan rutin diubah dari halaman Tagihan Rutin supaya
            tanda sudah dibayarnya ikut menyesuaikan, bukan ditinggalkan. */}
        {transaction.source === 'manual' ? (
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Ubah
          </button>
        ) : null}

        <form ref={deleteFormRef} action={deleteAction}>
          <input type="hidden" name="id" value={transaction.id} />
        </form>
        <ConfirmDialog
          trigger={(open) => (
            <button type="button" className="link-button" onClick={open} disabled={deletePending}>
              {deletePending ? '…' : 'Hapus'}
            </button>
          )}
          title="Hapus transaksi ini?"
          description="Transaksi yang sudah dihapus tidak bisa dikembalikan."
          onConfirm={() => deleteFormRef.current?.requestSubmit()}
          pending={deletePending}
        />
      </div>
    </li>
  )
}
