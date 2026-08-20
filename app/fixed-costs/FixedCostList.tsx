'use client'

import { useActionState, useState } from 'react'
import {
  addFixedCost,
  deleteFixedCost,
  markFixedCostPaid,
  markFixedCostUnpaid,
} from '@/app/actions/fixed-costs'
import type { ActionResult } from '@/app/actions/transactions'
import MoneyInput from '@/app/components/MoneyInput'
import { formatRupiah } from '@/lib/core/format'

export type FixedCostView = {
  id: string
  name: string
  amount: number
  /** Siklusnya dalam bahasa manusia, mis. "Setiap Senin". */
  scheduleLabel: string
  daysToDue: number
  /** Berapa kali biaya ini masih akan jatuh tempo dalam horizon kewajiban. */
  unpaidAhead: number
  period: string
  paid: boolean
}

const WEEKDAY_OPTIONS = [
  'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu',
]

const MONTH_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

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
    ? 'Yang terdekat sudah lunas'
    : cost.daysToDue === 0
      ? 'Jatuh tempo hari ini'
      : `Jatuh tempo ${cost.daysToDue} hari lagi`

  // Untuk siklus pendek, sekali jatuh tempo bukan gambaran utuh: yang benar-
  // benar disisihkan adalah seluruh kejadian dalam horizon.
  const aheadLabel =
    cost.unpaidAhead > 1 ? ` · ${cost.unpaidAhead}× disisihkan ke depan` : ''

  return (
    <li className="fixed-row">
      <div className="tx-main">
        <p className="tx-title">{cost.name}</p>
        <p className="tx-meta">
          {cost.scheduleLabel} · {dueLabel}
          {aheadLabel}
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
  // Field jatuh tempo berubah arti mengikuti siklus, jadi pilihannya dijaga di
  // state — menampilkan "tanggal 1–31" untuk tagihan mingguan hanya membingungkan.
  const [recurrence, setRecurrence] = useState('monthly')

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
            <MoneyInput name="amount" required />
          </label>
          <label>
            Siklus
            <select
              name="recurrence"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value)}
            >
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
              <option value="yearly">Tahunan</option>
            </select>
          </label>

          {recurrence === 'weekly' ? (
            <label>
              Hari jatuh tempo
              <select name="due_day" defaultValue={1}>
                {WEEKDAY_OPTIONS.map((day, index) => (
                  <option key={day} value={index + 1}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {recurrence === 'yearly' ? (
            <label>
              Bulan jatuh tempo
              <select name="due_month" defaultValue={1}>
                {MONTH_OPTIONS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {recurrence === 'monthly' || recurrence === 'yearly' ? (
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
          ) : null}
        </div>

        {recurrence === 'daily' ? (
          <p className="helper-text">
            Biaya harian disisihkan untuk setiap hari dalam horizon kewajiban, jadi
            jatah harianmu ikut menyesuaikan sejak sekarang.
          </p>
        ) : null}

        <button type="submit" className="btn btn-cta" disabled={pending}>
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
