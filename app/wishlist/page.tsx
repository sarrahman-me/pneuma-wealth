import Link from 'next/link'
import { and, desc, eq, ne } from 'drizzle-orm'
import WishList from './WishList'
import { getDb } from '@/lib/db'
import { wishItems } from '@/lib/db/schema'
import { formatRupiah } from '@/lib/core/format'
import { computeBaseAllowance } from '@/lib/core/allowance'
import { planWishPurchase, viewWish, type WishItem, type WishView } from '@/lib/core/wish'
import { getCurrentUser } from '@/lib/server/user'
import { getDailyState, toSettings } from '@/lib/server/state'

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

  // Horizon yang benar-benar dipakai hari ini, supaya jatah harian yang
  // diramalkan di sini sebanding dengan yang tampil di Beranda.
  const planning = { ...toSettings(user.settings), allowanceHorizonDays: state.horizon.days }

  const toView = (
    row: typeof wishItems.$inferSelect,
    withImpact: boolean,
  ): WishView =>
    viewWish(
      toItem(row),
      state.today,
      user.settings.dailyLivingCost,
      state.allowance.allowed,
      withImpact
        ? planWishPurchase(row.amount, state.funds, planning, computeBaseAllowance)
        : null,
    )

  // Akibat hanya dihitung untuk yang masih ditunggu — keputusan yang sudah
  // lewat tidak perlu diramalkan lagi.
  const waiting = waitingRows.map((row) => toView(row, true))
  const decided = decidedRows.map((row) => toView(row, false))

  const released = decided.filter((wish) => wish.status === 'released')
  const releasedTotal = released.reduce((sum, wish) => sum + wish.amount, 0)
  const waitingTotal = waiting.reduce((sum, wish) => sum + wish.amount, 0)

  return (
    <main>
      <h1>Keinginan</h1>
      <p>
        Cuma di halaman ini aplikasi ikut campur sebelum uang keluar. Masa tunggu
        memastikan keinginannya bertahan; hitungan di tiap barisnya memperlihatkan
        harganya bagi hari-harimu setelah dibeli.
      </p>

      <section className="wish-summary">
        <div>
          <p className="metric-title">Sedang ditahan</p>
          <p className="metric-value">{formatRupiah(waitingTotal)}</p>
          <p className="metric-desc">{waiting.length} keinginan masih ditunggu.</p>
        </div>
        <div>
          <p className="metric-title">Batal dibeli</p>
          <p className="metric-value">{formatRupiah(releasedTotal)}</p>
          <p className="metric-desc">
            {released.length > 0
              ? 'Uang yang tidak jadi keluar karena kamu mau menunggu.'
              : 'Belum ada. Nanti muncul setelah keinginan pertama kamu lepaskan.'}
          </p>
        </div>
      </section>

      <WishList waiting={waiting} decided={decided} />
    </main>
  )
}
