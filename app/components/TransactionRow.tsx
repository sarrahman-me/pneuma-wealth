'use client'

import { useActionState } from 'react'
import { deleteTransaction, type ActionResult } from '@/app/actions/transactions'
import { formatRupiah } from '@/lib/core/format'

export type TransactionView = {
  id: string
  kind: 'IN' | 'OUT'
  amount: number
  dateLocal: string
  description: string | null
  source: 'manual' | 'fixed_cost'
  categoryName: string | null
}

export default function TransactionRow({
  transaction,
  showDate = false,
}: {
  transaction: TransactionView
  showDate?: boolean
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => deleteTransaction(formData),
    null,
  )

  const meta = [
    showDate ? transaction.dateLocal : null,
    transaction.categoryName,
    transaction.source === 'fixed_cost' ? 'Biaya tetap' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="tx-row">
      <div className="tx-main">
        <p className="tx-title">{transaction.description ?? 'Tanpa keterangan'}</p>
        {meta ? <p className="tx-meta">{meta}</p> : null}
        {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
      </div>

      <span className={transaction.kind === 'IN' ? 'tx-amount pill-in' : 'tx-amount'}>
        {transaction.kind === 'IN' ? '+' : '−'}
        {formatRupiah(transaction.amount)}
      </span>

      <form action={formAction}>
        <input type="hidden" name="id" value={transaction.id} />
        <button type="submit" className="link-button" disabled={pending}>
          {pending ? '…' : 'Hapus'}
        </button>
      </form>
    </li>
  )
}
