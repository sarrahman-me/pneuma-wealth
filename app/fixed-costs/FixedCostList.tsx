'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import {
  addFixedCost,
  deleteFixedCost,
  markFixedCostPaid,
  markFixedCostUnpaid,
  updateFixedCost,
} from '@/app/actions/fixed-costs'
import type { ActionResult } from '@/app/actions/transactions'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import MoneyInput from '@/app/components/MoneyInput'
import { formatRupiah } from '@/lib/core/format'

export type FixedCostView = {
  id: string
  name: string
  amount: number
  /** Jadwalnya dalam bahasa sehari-hari, mis. "Setiap Senin". */
  scheduleLabel: string
  recurrence: 'daily' | 'weekly' | 'monthly' | 'yearly'
  dueDay: number
  dueMonth: number
  /** Negatif berarti jatuh temponya sudah lewat dan belum ditandai lunas. */
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
 * Field jatuh tempo berubah arti mengikuti pengulangannya, jadi pilihannya dijaga
 * di state — menampilkan "tanggal 1–31" untuk tagihan mingguan hanya membingungkan.
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
        Berulang
        <select
          name="recurrence"
          value={recurrence}
          onChange={(event) => onRecurrenceChange(event.target.value)}
        >
          <option value="daily">Setiap hari</option>
          <option value="weekly">Setiap minggu</option>
          <option value="monthly">Setiap bulan</option>
          <option value="yearly">Setiap tahun</option>
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

/** Tagihan harian tidak punya tanggal jatuh tempo; yang perlu dijelaskan justru dampaknya. */
function DailyNote() {
  return (
    <p className="helper-text">
      Tagihan harian dipisahkan untuk setiap hari ke depan, jadi jatah harianmu
      ikut menyesuaikan sejak sekarang.
    </p>
  )
}

function Row({ cost }: { cost: FixedCostView }) {
  const [editing, setEditing] = useState(false)
  const [recurrence, setRecurrence] = useState<string>(cost.recurrence)
  const deleteFormRef = useRef<HTMLFormElement>(null)

  const [paidState, paidAction, paidPending] = useAction(
    cost.paid ? markFixedCostUnpaid : markFixedCostPaid,
  )
  const [deleteState, deleteAction, deletePending] = useAction(deleteFixedCost)
  const [editState, editAction, editPending] = useAction(updateFixedCost)

  useEffect(() => {
    if (editState?.ok) setEditing(false)
  }, [editState])

  const overdue = !cost.paid && cost.daysToDue < 0

  const dueLabel = cost.paid
    ? 'Yang terdekat sudah dibayar'
    : overdue
      ? `Telat ${Math.abs(cost.daysToDue)} hari`
      : cost.daysToDue === 0
        ? 'Jatuh tempo hari ini'
        : `Jatuh tempo ${cost.daysToDue} hari lagi`

  // Untuk siklus pendek, sekali jatuh tempo bukan gambaran utuh: yang benar-
  // benar disisihkan adalah seluruh kejadian dalam horizon.
  const aheadLabel =
    cost.unpaidAhead > 1 ? ` · uangnya dipisahkan ${cost.unpaidAhead}× ke depan` : ''

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
              Kalau pengulangannya diubah, tanda sudah dibayar yang lama tidak lagi cocok
              dengan jadwal baru. Catatan pembayarannya tetap tersimpan.
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
    <li className={overdue ? 'fixed-row fixed-row-overdue' : 'fixed-row'}>
      <div className="tx-main">
        <p className="tx-title">{cost.name}</p>
        <p className={overdue ? 'tx-meta tx-meta-overdue' : 'tx-meta'}>
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
            {paidPending ? '…' : cost.paid ? 'Batalkan' : 'Sudah dibayar'}
          </button>
        </form>

        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          Ubah
        </button>

        <form ref={deleteFormRef} action={deleteAction}>
          <input type="hidden" name="id" value={cost.id} />
        </form>
        <ConfirmDialog
          trigger={(open) => (
            <button type="button" className="link-button" onClick={open} disabled={deletePending}>
              {deletePending ? '…' : 'Hapus'}
            </button>
          )}
          title="Hapus tagihan rutin ini?"
          description="Riwayat pembayaran yang sudah tercatat untuk tagihan ini ikut terhapus."
          onConfirm={() => deleteFormRef.current?.requestSubmit()}
          pending={deletePending}
        />
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
            <input name="name" placeholder="Kontrakan, listrik, internet…" required />
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
          {pending ? 'Menyimpan…' : 'Tambah tagihan rutin'}
        </button>

        {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
      </form>

      {costs.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">Belum ada tagihan rutin.</p>
          <p className="empty-desc">
            Masukkan kontrakan atau langganan supaya uangnya dipisahkan sejak awal.
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
