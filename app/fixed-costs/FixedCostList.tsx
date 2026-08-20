'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  addFixedCost,
  deleteFixedCost,
  markFixedCostPaid,
  markFixedCostUnpaid,
  updateFixedCost,
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
  recurrence: 'daily' | 'weekly' | 'monthly' | 'yearly'
  dueDay: number
  dueMonth: number
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

/**
 * Field jatuh tempo berubah arti mengikuti siklus, jadi pilihannya dijaga di
 * state — menampilkan "tanggal 1–31" untuk tagihan mingguan hanya membingungkan.
 * Dipakai bersama oleh form tambah dan form ubah supaya keduanya tidak pernah
 * berbeda aturan.
 */
function ScheduleFields({
  recurrence,
  onRecurrenceChange,
  dueDay,
  dueMonth,
}: {
  recurrence: string
  onRecurrenceChange: (value: string) => void
  dueDay: number
  dueMonth: number
}) {
  return (
    <>
      <label>
        Siklus
        <select
          name="recurrence"
          value={recurrence}
          onChange={(event) => onRecurrenceChange(event.target.value)}
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
          <select name="due_day" defaultValue={dueDay >= 1 && dueDay <= 7 ? dueDay : 1}>
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
          <select name="due_month" defaultValue={dueMonth}>
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
            defaultValue={dueDay >= 1 && dueDay <= 31 ? dueDay : 1}
            required
          />
        </label>
      ) : null}
    </>
  )
}

/** Biaya harian tidak punya tanggal jatuh tempo; yang perlu dijelaskan justru dampaknya. */
function DailyNote() {
  return (
    <p className="helper-text">
      Biaya harian disisihkan untuk setiap hari dalam horizon kewajiban, jadi
      jatah harianmu ikut menyesuaikan sejak sekarang.
    </p>
  )
}

function Row({ cost }: { cost: FixedCostView }) {
  const [editing, setEditing] = useState(false)
  const [recurrence, setRecurrence] = useState<string>(cost.recurrence)

  const [paidState, paidAction, paidPending] = useAction(
    cost.paid ? markFixedCostUnpaid : markFixedCostPaid,
  )
  const [deleteState, deleteAction, deletePending] = useAction(deleteFixedCost)
  const [editState, editAction, editPending] = useAction(updateFixedCost)

  useEffect(() => {
    if (editState?.ok) setEditing(false)
  }, [editState])

  const dueLabel = cost.paid
    ? 'Yang terdekat sudah lunas'
    : cost.daysToDue === 0
      ? 'Jatuh tempo hari ini'
      : `Jatuh tempo ${cost.daysToDue} hari lagi`

  // Untuk siklus pendek, sekali jatuh tempo bukan gambaran utuh: yang benar-
  // benar disisihkan adalah seluruh kejadian dalam horizon.
  const aheadLabel =
    cost.unpaidAhead > 1 ? ` · ${cost.unpaidAhead}× disisihkan ke depan` : ''

  if (editing) {
    return (
      <li className="fixed-row fixed-row-editing">
        <form action={editAction} className="row-editor">
          <input type="hidden" name="id" value={cost.id} />

          <div className="form-grid">
            <label>
              Nama
              <input name="name" defaultValue={cost.name} required />
            </label>
            <label>
              Jumlah
              <MoneyInput name="amount" defaultValue={cost.amount} required />
            </label>
            <ScheduleFields
              recurrence={recurrence}
              onRecurrenceChange={setRecurrence}
              dueDay={cost.dueDay}
              dueMonth={cost.dueMonth}
            />
          </div>

          {recurrence === 'daily' ? <DailyNote /> : null}

          {/* Pembayaran yang sudah tercatat pakai bentuk kunci siklus lamanya,
              jadi mengubah siklus membuatnya tidak lagi terhitung lunas untuk
              siklus yang baru. Lebih baik dikatakan daripada mengejutkan. */}
          {recurrence !== cost.recurrence ? (
            <p className="helper-text">
              Mengubah siklus membuat catatan lunas yang lama tidak lagi cocok dengan
              periode yang baru. Riwayat transaksinya tetap tersimpan.
            </p>
          ) : null}

          <div className="row-editor-actions">
            <button type="submit" className="btn" disabled={editPending}>
              {editPending ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setRecurrence(cost.recurrence)
                setEditing(false)
              }}
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

        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          Ubah
        </button>

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
          <ScheduleFields
            recurrence={recurrence}
            onRecurrenceChange={setRecurrence}
            dueDay={1}
            dueMonth={1}
          />
        </div>

        {recurrence === 'daily' ? <DailyNote /> : null}

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
