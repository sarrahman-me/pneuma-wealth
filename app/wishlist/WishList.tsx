'use client'

import { useActionState } from 'react'
import { addWish, buyWish, deleteWish, releaseWish } from '@/app/actions/wishes'
import MoneyInput from '@/app/components/MoneyInput'
import type { ActionResult } from '@/app/actions/transactions'
import { formatMultiplier, formatRupiah, formatShortDate } from '@/lib/core/format'
import type { WishView } from '@/lib/core/wish'

const useAction = (action: (formData: FormData) => Promise<ActionResult>) =>
  useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  )

function WaitingRow({ wish }: { wish: WishView }) {
  const [buyState, buyAction, buyPending] = useAction(buyWish)
  const [releaseState, releaseAction, releasePending] = useAction(releaseWish)

  const cost = [
    wish.costInDays !== null && wish.costInDays >= 1 ? `${wish.costInDays} hari hidup` : null,
    wish.costInAllowances !== null
      ? `${formatMultiplier(wish.costInAllowances)} jatah harian`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={wish.ready ? 'wish-row wish-ready' : 'wish-row'}>
      <div className="wish-main">
        <p className="wish-name">{wish.name}</p>
        <p className="wish-cost">{cost || 'Isi biaya hidup harian untuk melihat harganya dalam hari.'}</p>
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
        </div>
      ) : (
        <div className="wish-actions">
          <span className="wish-countdown">
            {wish.daysLeft} hari lagi
          </span>
          <form action={releaseAction}>
            <input type="hidden" name="id" value={wish.id} />
            <button type="submit" className="link-button" disabled={releasePending}>
              {releasePending ? '…' : 'Lepaskan sekarang'}
            </button>
          </form>
        </div>
      )}
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
          Tulis dulu, jangan beli dulu. Lama tunggunya ditentukan seberapa besar
          keinginan ini dibanding jatah harianmu.
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
              <input name="note" placeholder="Opsional" />
            </label>
          </div>
          <button type="submit" className="btn" disabled={pending}>
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
              Lain kali dorongan membeli datang, catat di sini dulu.
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
