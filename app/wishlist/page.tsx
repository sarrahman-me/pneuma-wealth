import Link from 'next/link'
import { and, desc, eq, ne } from 'drizzle-orm'
import WishList from './WishList'
import { getDb } from '@/lib/db'
import { wishItems } from '@/lib/db/schema'
import { formatRupiah } from '@/lib/core/format'
import { viewWish, type WishItem, type WishView } from '@/lib/core/wish'
import { getCurrentUser } from '@/lib/server/user'
import { getDailyState } from '@/lib/server/state'

export const dynamic = 'force-dynamic'

const toItem = (row: typeof wishItems.$inferSelect): WishItem => ({
  id: row.id,
  name: row.name,
  amount: row.amount,
  note: row.note,
  createdOn: row.createdOn,
  readyOn: row.readyOn,
  status: row.status,
})

export default async function WishlistPage() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <main>
        <h1>Keinginan</h1>
        <p>
          <Link href="/sign-in">Masuk</Link> untuk mencatat keinginan.
        </p>
      </main>
    )
  }

  const state = await getDailyState(user)
  const db = getDb()

  const [waitingRows, decidedRows] = await Promise.all([
    db
      .select()
      .from(wishItems)
      .where(and(eq(wishItems.userId, user.id), eq(wishItems.status, 'waiting')))
      .orderBy(wishItems.readyOn),
    db
      .select()
      .from(wishItems)
      .where(and(eq(wishItems.userId, user.id), ne(wishItems.status, 'waiting')))
      .orderBy(desc(wishItems.decidedAt))
      .limit(20),
  ])

  const toView = (row: typeof wishItems.$inferSelect): WishView =>
    viewWish(
      toItem(row),
      state.today,
      user.settings.dailyLivingCost,
      state.allowance.allowed,
    )

  const waiting = waitingRows.map(toView)
  const decided = decidedRows.map(toView)

  const released = decided.filter((wish) => wish.status === 'released')
  const releasedTotal = released.reduce((sum, wish) => sum + wish.amount, 0)
  const waitingTotal = waiting.reduce((sum, wish) => sum + wish.amount, 0)

  return (
    <main>
      <h1>Keinginan</h1>
      <p>
        Halaman ini satu-satunya tempat aplikasi ikut campur sebelum uang keluar.
        Sisanya hanya mencatat yang sudah lewat.
      </p>

      <section className="wish-summary">
        <div>
          <p className="metric-title">Sedang ditahan</p>
          <p className="metric-value">{formatRupiah(waitingTotal)}</p>
          <p className="metric-desc">{waiting.length} keinginan menunggu keputusan.</p>
        </div>
        <div>
          <p className="metric-title">Berhasil dilepaskan</p>
          <p className="metric-value">{formatRupiah(releasedTotal)}</p>
          <p className="metric-desc">
            {released.length > 0
              ? 'Uang yang tidak jadi keluar karena kamu menunggu.'
              : 'Belum ada. Akan muncul setelah keinginan pertama dilepaskan.'}
          </p>
        </div>
      </section>

      <WishList waiting={waiting} decided={decided} />
    </main>
  )
}
