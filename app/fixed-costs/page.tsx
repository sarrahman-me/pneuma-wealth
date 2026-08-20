import Link from 'next/link'
import { and, eq, inArray } from 'drizzle-orm'
import FixedCostList, { type FixedCostView } from './FixedCostList'
import { getDb } from '@/lib/db'
import { fixedCostPayments, fixedCosts } from '@/lib/db/schema'
import {
  daysUntilDue,
  describeSchedule,
  nextDue,
  occurrencesWithin,
  periodKeyFor,
} from '@/lib/core/due'
import { todayIn } from '@/lib/core/timezone'
import { formatRupiah } from '@/lib/core/format'
import { getCurrentUser } from '@/lib/server/user'

export const dynamic = 'force-dynamic'

export default async function FixedCostsPage() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <main>
        <h1>Biaya Tetap</h1>
        <p>
          <Link href="/sign-in">Masuk</Link> untuk mengelola biaya tetap.
        </p>
      </main>
    )
  }

  const db = getDb()
  const today = todayIn(user.timezone)

  const costs = await db
    .select()
    .from(fixedCosts)
    .where(and(eq(fixedCosts.userId, user.id), eq(fixedCosts.isActive, true)))

  const payments =
    costs.length > 0
      ? await db
          .select()
          .from(fixedCostPayments)
          .where(
            inArray(
              fixedCostPayments.fixedCostId,
              costs.map((cost) => cost.id),
            ),
          )
      : []

  const paidKeys = new Set(
    payments
      .filter((payment) => payment.transactionId !== null)
      .map((payment) => `${payment.fixedCostId}:${payment.period}`),
  )

  // Horizon yang sama dengan yang dipakai beranda untuk menyisihkan uang, jadi
  // angka di halaman ini tidak pernah berbeda dari yang sudah dipotong di sana.
  const horizonDays = user.settings.obligationHorizonDays

  const view: FixedCostView[] = costs
    .map((cost) => {
      const period = periodKeyFor(cost.recurrence, nextDue(today, cost))
      const unpaidAhead = occurrencesWithin(today, cost, horizonDays).filter(
        (due) => !paidKeys.has(`${cost.id}:${periodKeyFor(cost.recurrence, due)}`),
      ).length

      return {
        id: cost.id,
        name: cost.name,
        amount: cost.amount,
        scheduleLabel: describeSchedule(cost),
        recurrence: cost.recurrence,
        dueDay: cost.dueDay,
        dueMonth: cost.dueMonth,
        daysToDue: daysUntilDue(today, cost),
        unpaidAhead,
        period,
        paid: paidKeys.has(`${cost.id}:${period}`),
      }
    })
    .sort((a, b) => a.daysToDue - b.daysToDue)

  // Siklus pendek dihitung sebanyak kejadiannya, bukan sekali — inilah nilai
  // yang benar-benar disisihkan dari uang belanja.
  const unpaidTotal = view.reduce((sum, cost) => sum + cost.amount * cost.unpaidAhead, 0)

  return (
    <main>
      <h1>Biaya Tetap</h1>
      <p>
        Tagihan yang belum lunas otomatis disisihkan dari uang yang bisa kamu belanjakan, jadi jatah
        harianmu tidak pernah terlalu optimis.
      </p>

      <section className="fixed-summary">
        <p className="metric-title">Disisihkan untuk {horizonDays} hari ke depan</p>
        <p className="metric-value">{formatRupiah(unpaidTotal)}</p>
      </section>

      <FixedCostList costs={view} />
    </main>
  )
}
