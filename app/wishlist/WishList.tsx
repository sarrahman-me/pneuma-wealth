'use client'

import { useActionState, useEffect, useState } from 'react'
import { addWish, buyWish, deleteWish, releaseWish, updateWish } from '@/app/actions/wishes'
import MoneyInput from '@/app/components/MoneyInput'
import type { ActionResult } from '@/app/actions/transactions'
import { formatMultiplier, formatRupiah, formatShortDate } from '@/lib/core/format'
import type { WishImpact, WishView } from '@/lib/core/wish'

/**
 * Akibat pembelian, dalam kalimat.
 *
 * Nadanya sengaja tidak melarang: uangnya tetap milik pengguna dan tombol
 * belinya tidak pernah dikunci. Yang ditambahkan cuma satu hal yang selama ini
 * hilang — melihat harganya dalam jatah harian dan dana cadangan sebelum
 * memutuskan, bukan setelah uangnya keluar.
 */
const impactCopy = (impact: WishImpact): { verdict: string; detail: string } => {
  const parts = [
    impact.dailyBefore === impact.dailyAfter
      ? `jatah harian tetap ${formatRupiah(impact.dailyAfter)}`
      : `jatah harian ${formatRupiah(impact.dailyBefore)} → ${formatRupiah(impact.dailyAfter)}`,
    impact.bufferBefore > 0 || impact.bufferAfter > 0
      ? `dana cadangan ${formatRupiah(impact.bufferBefore)} → ${formatRupiah(impact.bufferAfter)}`
      : null,
  ].filter(Boolean)

  const detail = `Kalau dibeli hari ini: ${parts.join(', ')}.`

  if (impact.verdict === 'belum') {
    return {
      verdict: `Uangmu belum sampai ke sana — kurang ${formatRupiah(impact.shortfall)}, dan ${formatRupiah(impact.fromObligations)} di antaranya uang yang sudah jadi milik tagihan.`,
      detail,
    }
  }

  if (impact.verdict === 'ketat') {
    return {
      verdict: `Muat, tapi ${formatRupiah(impact.fromBuffer)} diambil dari dana cadangan.`,
      detail,
    }
  }

  return {
    verdict: 'Muat di uang yang memang boleh dibelanjakan.',
    detail,
  }
}

function ImpactNote({ impact }: { impact: WishImpact }) {
  const copy = impactCopy(impact)

  return (
    <div className={`wish-impact wish-impact-${impact.verdict}`}>
      <p className="wish-impact-verdict">{copy.verdict}</p>
      <p className="wish-impact-detail">{copy.detail}</p>
    </div>
  )
}

const useAction = (action: (formData: FormData) => Promise<ActionResult>) =>
  useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  )

function WaitingRow({ wish }: { wish: WishView }) {
  const [editing, setEditing] = useState(false)

  const [buyState, buyAction, buyPending] = useAction(buyWish)
  const [releaseState, releaseAction, releasePending] = useAction(releaseWish)
  const [editState, editAction, editPending] = useAction(updateWish)

  useEffect(() => {
    if (editState?.ok) setEditing(false)
  }, [editState])

  const cost = [
    wish.costInDays !== null && wish.costInDays >= 1 ? `${wish.costInDays} hari hidup` : null,
    wish.costInAllowances !== null
      ? `${formatMultiplier(wish.costInAllowances)} jatah harian`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (editing) {
    return (
      <li className="wish-row wish-row-editing">
        <form action={editAction} className="row-editor">
          <input type="hidden" name="id" value={wish.id} />

          <div className="form-grid">
            <label>
              Apa yang ingin dibeli
              <input name="name" defaultValue={wish.name} required />
            </label>
            <label>
              Perkiraan harga
              <MoneyInput name="amount" defaultValue={wish.amount} required />
            </label>
            <label>
              Alasan
              <input name="note" defaultValue={wish.note ?? ''} placeholder="Boleh dikosongkan" />
            </label>
          </div>

          {/* Aturannya disebutkan di depan supaya tidak terasa seperti aplikasi
              mengabaikan suntingan: menurunkan harga memang tidak memendekkan
              jeda yang sedang berjalan. */}
          <p className="helper-text">
            Kalau harganya dinaikkan, masa tunggunya bisa bertambah. Kalau diturunkan,
            tunggu yang sedang berjalan tidak jadi lebih pendek.
          </p>

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
    <li className={wish.ready ? 'wish-row wish-ready' : 'wish-row'}>
      <div className="wish-main">
        <p className="wish-name">{wish.name}</p>
        <p className="wish-cost">
          {cost || 'Isi biaya hidup harian dulu supaya harganya bisa dibaca dalam hari.'}
        </p>
        {buyState && !buyState.ok ? <p className="alert-error">{buyState.error}</p> : null}
        {releaseState && !releaseState.ok ? (
          <p className="alert-error">{releaseState.error}</p>
        ) : null}
      </div>

      <span className="wish-amount">{formatRupiah(wish.amount)}</span>

      {wish.ready ? (
        <div className="wish-actions">
          <form action={buyAction}>
            <input type="hidden" name="id" value={wish.id} />
            <button type="submit" className="btn" disabled={buyPending}>
              {buyPending ? '…' : 'Masih mau, beli'}
            </button>
          </form>
          <form action={releaseAction}>
            <input type="hidden" name="id" value={wish.id} />
            <button type="submit" className="btn btn-quiet" disabled={releasePending}>
              {releasePending ? '…' : 'Lepaskan'}
            </button>
          </form>
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Ubah
          </button>
        </div>
      ) : (
        <div className="wish-actions">
          <span className="wish-countdown">
            {wish.daysLeft} hari lagi
          </span>
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Ubah
          </button>
          <form action={releaseAction}>
            <input type="hidden" name="id" value={wish.id} />
            <button type="submit" className="link-button" disabled={releasePending}>
              {releasePending ? '…' : 'Lepaskan sekarang'}
            </button>
          </form>
        </div>
      )}

      {/* Ditaruh sebagai anak langsung baris supaya melebar penuh di bawah
          harga dan tombol — kalimatnya perlu ruang, bukan kolom sempit. */}
      {wish.impact ? <ImpactNote impact={wish.impact} /> : null}
    </li>
  )
}

function DecidedRow({ wish }: { wish: WishView }) {
  const [state, action, pending] = useAction(deleteWish)

  return (
    <li className="wish-row wish-decided">
      <div className="wish-main">
        <p className="wish-name">{wish.name}</p>
        <p className="wish-cost">
          {wish.status === 'released' ? 'Dilepaskan' : 'Dibeli'} · dicatat{' '}
          {formatShortDate(wish.createdOn)}
        </p>
        {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
      </div>
      <span className="wish-amount">{formatRupiah(wish.amount)}</span>
      <form action={action}>
        <input type="hidden" name="id" value={wish.id} />
        <button type="submit" className="link-button" disabled={pending}>
          {pending ? '…' : 'Hapus'}
        </button>
      </form>
    </li>
  )
}

export default function WishList({
  waiting,
  decided,
}: {
  waiting: WishView[]
  decided: WishView[]
}) {
  const [state, formAction, pending] = useAction(addWish)

  return (
    <>
      <section className="wish-form">
        <h2>Catat keinginan</h2>
        <p className="helper-text">
          Tulis dulu, jangan langsung beli. Makin besar harganya dibanding jatah
          harianmu, makin lama nunggunya.
        </p>
        <form action={formAction}>
          <div className="form-grid">
            <label>
              Apa yang ingin dibeli
              <input name="name" placeholder="Sepatu, gadget, langganan…" required />
            </label>
            <label>
              Perkiraan harga
              <MoneyInput name="amount" required />
            </label>
            <label>
              Alasan
              <input name="note" placeholder="Boleh dikosongkan" />
            </label>
          </div>
          <button type="submit" className="btn btn-cta" disabled={pending}>
            {pending ? 'Menyimpan…' : 'Tahan dulu'}
          </button>
          {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
        </form>
      </section>

      <section>
        <h2>Sedang ditahan</h2>
        {waiting.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">Tidak ada keinginan yang sedang ditahan.</p>
            <p className="empty-desc">
              Lain kali kepingin sesuatu, catat di sini dulu.
            </p>
          </div>
        ) : (
          <ul className="wish-list">
            {waiting.map((wish) => (
              <WaitingRow key={wish.id} wish={wish} />
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section>
          <h2>Sudah diputuskan</h2>
          <ul className="wish-list">
            {decided.map((wish) => (
              <DecidedRow key={wish.id} wish={wish} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
