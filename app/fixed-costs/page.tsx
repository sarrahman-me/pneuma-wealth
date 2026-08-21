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
  overdueOccurrence,
  periodKeyFor,
} from '@/lib/core/due'
import { daysBetween } from '@/lib/core/money'
import { todayIn } from '@/lib/core/timezone'
import { formatRupiah } from '@/lib/core/format'
import { getCurrentUser } from '@/lib/server/user'

export const dynamic = 'force-dynamic'

export default async function FixedCostsPage() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <main>
        <h1>Tagihan Rutin</h1>
        <p>
          <Link href="/sign-in">Masuk</Link> untuk mengatur tagihan rutin.
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
      const isPaid = (due: string) =>
        paidKeys.has(`${cost.id}:${periodKeyFor(cost.recurrence, due)}`)

      // Tagihan tidak bisa menunggak sebelum ia dicatat.
      const since = todayIn(user.timezone, cost.createdAt)
      const overdue = overdueOccurrence(today, cost, since)
      const stillOwed = overdue !== null && !isPaid(overdue)

      // Tombolnya harus menunjuk kejadian tertua yang belum lunas, sama seperti
      // yang dipakai server saat menandai bayar — kalau berbeda, tombolnya akan
      // menyatakan satu periode sementara yang tercatat periode lain.
      const target = stillOwed && overdue ? overdue : nextDue(today, cost)
      const period = periodKeyFor(cost.recurrence, target)

      const unpaidAhead = occurrencesWithin(today, cost, horizonDays, since).filter(
        (due) => !isPaid(due),
      ).length

      return {
        id: cost.id,
        name: cost.name,
        amount: cost.amount,
        scheduleLabel: describeSchedule(cost),
        recurrence: cost.recurrence,
        dueDay: cost.dueDay,
        dueMonth: cost.dueMonth,
        // Negatif berarti sudah lewat. Menampilkan jatuh tempo siklus
        // berikutnya di sini adalah cara paling halus untuk berbohong.
        daysToDue: stillOwed && overdue ? daysBetween(today, overdue) : daysUntilDue(today, cost),
        unpaidAhead,
        period,
        paid: isPaid(target),
      }
    })
    .sort((a, b) => a.daysToDue - b.daysToDue)

  // Siklus pendek dihitung sebanyak kejadiannya, bukan sekali — inilah nilai
  // yang benar-benar disisihkan dari uang belanja.
  const unpaidTotal = view.reduce((sum, cost) => sum + cost.amount * cost.unpaidAhead, 0)

  const overdueTotal = view
    .filter((cost) => !cost.paid && cost.daysToDue < 0)
    .reduce((sum, cost) => sum + cost.amount, 0)

  return (
    <main>
      <h1>Tagihan Rutin</h1>
      <p>
        Tagihan yang belum dibayar otomatis dipisahkan dari uang belanjamu, jadi jatah
        harian yang muncul bukan angka yang terlalu manis.
      </p>

      <section className="fixed-summary">
        <p className="metric-title">Dipisahkan untuk {horizonDays} hari ke depan</p>
        <p className="metric-value">{formatRupiah(unpaidTotal)}</p>
        {overdueTotal > 0 ? (
          <p className="metric-desc">
            Termasuk {formatRupiah(overdueTotal)} yang jatuh temponya sudah lewat dan
            belum ditandai lunas.
          </p>
        ) : null}
      </section>

      <FixedCostList costs={view} />
    </main>
  )
}
