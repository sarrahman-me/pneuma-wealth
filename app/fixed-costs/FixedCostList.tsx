'use client'

import { useActionState } from 'react'
import {
  addFixedCost,
  deleteFixedCost,
  markFixedCostPaid,
  markFixedCostUnpaid,
} from '@/app/actions/fixed-costs'
import type { ActionResult } from '@/app/actions/transactions'
import { formatRupiah } from '@/lib/core/format'

export type FixedCostView = {
  id: string
  name: string
  amount: number
  dueDay: number
  daysToDue: number
  period: string
  paid: boolean
}

const useAction = (action: (formData: FormData) => Promise<ActionResult>) =>
  useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  )

function Row({ cost }: { cost: FixedCostView }) {
  const [paidState, paidAction, paidPending] = useAction(
    cost.paid ? markFixedCostUnpaid : markFixedCostPaid,
  )
  const [deleteState, deleteAction, deletePending] = useAction(deleteFixedCost)

  const dueLabel = cost.paid
    ? `Lunas untuk ${cost.period}`
    : cost.daysToDue === 0
      ? 'Jatuh tempo hari ini'
      : `Jatuh tempo ${cost.daysToDue} hari lagi`

  return (
    <li className="fixed-row">
      <div className="tx-main">
        <p className="tx-title">{cost.name}</p>
        <p className="tx-meta">
          Tanggal {cost.dueDay} · {dueLabel}
        </p>
        {paidState && !paidState.ok ? <p className="alert-error">{paidState.error}</p> : null}
        {deleteState && !deleteState.ok ? (
          <p className="alert-error">{deleteState.error}</p>
        ) : null}
      </div>

      <span className="tx-amount">{formatRupiah(cost.amount)}</span>

      <div className="fixed-actions">
        <form action={paidAction}>
          <input type="hidden" name="id" value={cost.id} />
          <input type="hidden" name="period" value={cost.period} />
          <button
            type="submit"
            className={cost.paid ? 'btn btn-quiet' : 'btn'}
            disabled={paidPending}
          >
            {paidPending ? '…' : cost.paid ? 'Batalkan' : 'Tandai lunas'}
          </button>
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="id" value={cost.id} />
          <button type="submit" className="link-button" disabled={deletePending}>
            {deletePending ? '…' : 'Hapus'}
          </button>
        </form>
      </div>
    </li>
  )
}

export default function FixedCostList({ costs }: { costs: FixedCostView[] }) {
  const [state, formAction, pending] = useAction(addFixedCost)

  return (
    <>
      <form action={formAction} className="fixed-form">
        <div className="form-grid">
          <label>
            Nama
            <input name="name" placeholder="Sewa, listrik, internet…" required />
          </label>
          <label>
            Jumlah
            <input name="amount" inputMode="numeric" placeholder="0" required />
          </label>
          <label>
            Tanggal jatuh tempo
            <input
              name="due_day"
              inputMode="numeric"
              type="number"
              min={1}
              max={31}
              defaultValue={1}
              required
            />
          </label>
        </div>

        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Tambah biaya tetap'}
        </button>

        {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
      </form>

      {costs.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">Belum ada biaya tetap.</p>
          <p className="empty-desc">
            Tambahkan sewa atau langganan supaya uangnya disisihkan sejak awal.
          </p>
        </div>
      ) : (
        <ul className="fixed-list">
          {costs.map((cost) => (
            <Row key={cost.id} cost={cost} />
          ))}
        </ul>
      )}
    </>
  )
}
