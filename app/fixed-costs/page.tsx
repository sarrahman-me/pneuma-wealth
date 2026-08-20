import Link from 'next/link'
import { and, eq, inArray } from 'drizzle-orm'
import FixedCostList, { type FixedCostView } from './FixedCostList'
import { getDb } from '@/lib/db'
import { fixedCostPayments, fixedCosts } from '@/lib/db/schema'
import { daysUntilDue, nextMonthlyDue } from '@/lib/core/due'
import { periodOf } from '@/lib/core/money'
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

  const view: FixedCostView[] = costs
    .map((cost) => {
      const period = periodOf(nextMonthlyDue(today, cost.dueDay))
      return {
        id: cost.id,
        name: cost.name,
        amount: cost.amount,
        dueDay: cost.dueDay,
        daysToDue: daysUntilDue(today, cost.dueDay),
        period,
        paid: paidKeys.has(`${cost.id}:${period}`),
      }
    })
    .sort((a, b) => a.daysToDue - b.daysToDue)

  const unpaidTotal = view
    .filter((cost) => !cost.paid)
    .reduce((sum, cost) => sum + cost.amount, 0)

  return (
    <main>
      <h1>Biaya Tetap</h1>
      <p>
        Tagihan yang belum lunas otomatis disisihkan dari uang yang bisa kamu belanjakan, jadi jatah
        harianmu tidak pernah terlalu optimis.
      </p>

      <section className="fixed-summary">
        <p className="metric-title">Belum lunas periode ini</p>
        <p className="metric-value">{formatRupiah(unpaidTotal)}</p>
      </section>

      <FixedCostList costs={view} />
    </main>
  )
}
