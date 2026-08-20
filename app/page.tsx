import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import CoachingInsightCard from './components/CoachingInsightCard'
import AllowanceMeter from './components/AllowanceMeter'
import IncomeRitual from './components/IncomeRitual'
import QuickEntry from './components/QuickEntry'
import TransactionRow, { type TransactionView } from './components/TransactionRow'
import BurnChart from './components/charts/BurnChart'
import RhythmChart from './components/charts/RhythmChart'
import { getDb } from '@/lib/db'
import { categories, transactions } from '@/lib/db/schema'
import { formatMultiplier, formatRupiah } from '@/lib/core/format'
import { getCurrentUser, listAccounts, listCategories } from '@/lib/server/user'
import { getDailyState } from '@/lib/server/state'

// Angka harian selalu dihitung ulang per permintaan; tidak ada yang boleh di-cache.
export const dynamic = 'force-dynamic'

const fetchToday = async (userId: string, today: string): Promise<TransactionView[]> => {
  const rows = await getDb()
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      dateLocal: transactions.dateLocal,
      description: transactions.description,
      source: transactions.source,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.userId, userId), eq(transactions.dateLocal, today)))
    .orderBy(desc(transactions.createdAt))

  return rows
}

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <main>
        <h1>PNEUMA</h1>
        <p>Masuk untuk melanjutkan.</p>
        <Link href="/sign-in" className="btn btn-cta">
          Masuk
        </Link>
      </main>
    )
  }

  const state = await getDailyState(user)
  const [accounts, categoryList, todayTransactions] = await Promise.all([
    listAccounts(user.id),
    listCategories(user.id),
    fetchToday(user.id, state.today),
  ])

  const { allowance, funds, pace, stats } = state
  const categoryOptions = categoryList.map((category) => ({
    id: category.id,
    name: category.name,
  }))

  return (
    <main>
      <h1>Hari ini</h1>

      {state.incomePlan ? (
        <IncomeRitual plan={state.incomePlan} cadence={state.cadence} />
      ) : null}

      <CoachingInsightCard insight={state.insight} />

      {user.settings.dailyLivingCost <= 0 ? (
        <p className="soft-warn">
          Biaya hidup harian belum diisi, jadi dana cadangan dan perkiraan uangmu cukup
          sampai kapan belum bisa dihitung. <Link href="/rules">Isi sekarang</Link>.
        </p>
      ) : null}

      <section className="home-hero">
        <div className="hero-grid">
          <div className="hero-card hero-primary">
            <p className="hero-label">Boleh dipakai hari ini</p>
            <p className="hero-value">{formatRupiah(allowance.allowed)}</p>
            <AllowanceMeter allowance={allowance} />
            {allowance.carry !== 0 ? (
              <p className="helper-text">
                {allowance.carry > 0
                  ? `Termasuk ${formatRupiah(allowance.carry)} sisa kemarin.`
                  : `Dipotong ${formatRupiah(-allowance.carry)} dari kelebihan kemarin.`}
              </p>
            ) : (
              <p className="helper-text">Jatah dasar {formatRupiah(allowance.base)}.</p>
            )}
          </div>

          <div className={allowance.overspent ? 'hero-card hero-warn' : 'hero-card'}>
            <p className="hero-label">Sisa</p>
            <p className="hero-value">{formatRupiah(Math.max(0, allowance.remaining))}</p>
            <p className="helper-text">Terpakai {formatRupiah(allowance.spent)}.</p>
          </div>

          <div className="hero-card">
            <p className="hero-label">Uangnya cukup untuk</p>
            <p className="hero-value">
              {funds.runwayDays !== null ? `${funds.runwayDays} hari` : '—'}
            </p>
            <p className="helper-text">Kalau tidak ada uang masuk lagi, setelah tagihan lunas.</p>
          </div>
        </div>
      </section>

      {pace.daysElapsed !== null ? (
        <section className="pace-strip">
          <div className="pace-item">
            <span className="pace-label">Sejak uang masuk</span>
            <span className="pace-value">hari ke-{pace.daysElapsed}</span>
          </div>
          <div className="pace-item">
            <span className="pace-label">Kecepatan belanja</span>
            <span
              className={
                pace.paceRatio !== null && pace.paceRatio > 1.2
                  ? 'pace-value pace-value-alert'
                  : 'pace-value'
              }
            >
              {pace.paceRatio !== null ? formatMultiplier(pace.paceRatio) : '—'}
            </span>
          </div>
          <div className="pace-item">
            <span className="pace-label">Habis dalam</span>
            <span
              className={
                pace.shortfallDays !== null && pace.shortfallDays > 0
                  ? 'pace-value pace-value-alert'
                  : 'pace-value'
              }
            >
              {pace.daysUntilEmpty !== null ? `${pace.daysUntilEmpty} hari` : '—'}
            </span>
          </div>
          {pace.expectedCycleDays !== null ? (
            <div className="pace-item">
              <span className="pace-label">Uang masuk biasanya</span>
              <span className="pace-value">{pace.expectedCycleDays} hari sekali</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <QuickEntry
        accounts={accounts.map((account) => ({ id: account.id, name: account.name }))}
        categories={categoryOptions}
        today={state.today}
      />

      <section className="wish-cta">
        <div>
          <h2>Ada yang ingin dibeli?</h2>
          <p className="helper-text">
            Catat dulu, tahan sebentar. Kalau setelah ditunggu masih mau, berarti memang perlu.
            {stats.wishWaitingCount > 0
              ? ` Sekarang ada ${stats.wishWaitingCount} yang sedang ditahan.`
              : ''}
          </p>
        </div>
        <Link href="/wishlist" className="btn btn-quiet">
          {stats.wishReadyCount > 0
            ? `${stats.wishReadyCount} menunggu keputusan`
            : 'Buka daftar keinginan'}
        </Link>
      </section>

      <BurnChart burn={state.burn} pace={pace} />
      <RhythmChart days={state.recentDays} />

      <section className="tx-list">
        <div className="tx-header">
          <h2>Catatan hari ini</h2>
          <Link href="/history" className="link-button">
            Lihat riwayat
          </Link>
        </div>

        {todayTransactions.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">Belum ada catatan hari ini.</p>
            <p className="empty-desc">Satu catatan saja sudah cukup untuk menjaga kebiasaan.</p>
          </div>
        ) : (
          <ul>
            {todayTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categories={categoryOptions}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
