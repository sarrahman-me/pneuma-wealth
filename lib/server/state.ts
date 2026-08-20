import 'server-only'

import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { getDb } from '../db'
import {
  accounts,
  allowanceAnchors,
  categories,
  coachingMemory,
  dailyLedger,
  fixedCostPayments,
  fixedCosts,
  transactions,
} from '../db/schema'
import {
  computeCarry,
  computeDailyAllowance,
  createAnchor,
  needsReanchor,
} from '../core/allowance'
import { computeFunds } from '../core/funds'
import { computeInsight, timeBucketOf } from '../core/insight'
import { addDays, daysBetween, periodOf } from '../core/money'
import { nextMonthlyDue } from '../core/due'
import { hourIn, todayIn } from '../core/timezone'
import type { AllowanceAnchor, DailyAllowance, Funds, Settings } from '../core/types'
import type { CoachingInsight, InsightStats, MemoryEntry } from '../core/insight-types'
import type { CurrentUser } from './user'

export type Obligations = {
  /** Total kewajiban yang jatuh tempo dalam horizon — inilah yang dipotong di depan. */
  scheduled: number
  unpaidCount: number
  unpaidAmount: number
  daysToNextDue: number | null
}

export type DailyState = {
  today: string
  funds: Funds
  allowance: DailyAllowance
  anchor: AllowanceAnchor
  obligations: Obligations
  stats: InsightStats
  insight: CoachingInsight
}

const toSettings = (row: CurrentUser['settings']): Settings => ({
  dailyLivingCost: row.dailyLivingCost,
  bufferDays: row.bufferDays,
  allowanceHorizonDays: row.allowanceHorizonDays,
  allowanceMin: row.allowanceMin,
  allowanceMax: row.allowanceMax,
  obligationHorizonDays: row.obligationHorizonDays,
})

/**
 * Saldo likuid hanya dari akun `spendable`. Tabungan dan dana tujuan sengaja
 * tidak ikut, supaya uang yang sudah dipisahkan tidak diam-diam ikut
 * dibelanjakan lewat angka jatah harian.
 */
const fetchLiquidBalance = async (userId: string): Promise<number> => {
  const [row] = await getDb()
    .select({
      balance: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'IN' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)::bigint`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(eq(transactions.userId, userId), eq(accounts.kind, 'spendable')))

  return Number(row?.balance ?? 0)
}

const fetchObligations = async (
  userId: string,
  today: string,
  horizonDays: number,
): Promise<Obligations> => {
  const db = getDb()
  const active = await db
    .select()
    .from(fixedCosts)
    .where(and(eq(fixedCosts.userId, userId), eq(fixedCosts.isActive, true)))

  if (active.length === 0) {
    return { scheduled: 0, unpaidCount: 0, unpaidAmount: 0, daysToNextDue: null }
  }

  const payments = await db
    .select()
    .from(fixedCostPayments)
    .where(
      inArray(
        fixedCostPayments.fixedCostId,
        active.map((cost) => cost.id),
      ),
    )

  const paidKeys = new Set(
    payments
      .filter((payment) => payment.transactionId !== null)
      .map((payment) => `${payment.fixedCostId}:${payment.period}`),
  )

  let scheduled = 0
  let unpaidCount = 0
  let unpaidAmount = 0
  let daysToNextDue: number | null = null

  for (const cost of active) {
    const due = nextMonthlyDue(today, cost.dueDay)
    if (paidKeys.has(`${cost.id}:${periodOf(due)}`)) continue

    const days = daysBetween(today, due)
    unpaidCount += 1
    unpaidAmount += cost.amount
    if (days <= horizonDays) {
      scheduled += cost.amount
    }
    if (daysToNextDue === null || days < daysToNextDue) {
      daysToNextDue = days
    }
  }

  return { scheduled, unpaidCount, unpaidAmount, daysToNextDue }
}

/**
 * Hanya pengeluaran manual yang memakan jatah harian. Pembayaran biaya tetap
 * sudah disisihkan lewat `scheduled`, jadi menghitungnya lagi di sini berarti
 * menghukum pengguna dua kali di hari ia membayar tagihan.
 */
const fetchSpent = async (userId: string, from: string, to: string): Promise<number> => {
  const [row] = await getDb()
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::bigint` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, 'OUT'),
        eq(transactions.source, 'manual'),
        gte(transactions.dateLocal, from),
        lte(transactions.dateLocal, to),
      ),
    )

  return Number(row?.total ?? 0)
}

const fetchStats = async (
  userId: string,
  today: string,
  obligations: Obligations,
): Promise<InsightStats> => {
  const db = getDb()
  const weekStart = addDays(today, -6)

  const [counts] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      todayCount: sql<number>`COUNT(*) FILTER (WHERE ${transactions.dateLocal} = ${today})::int`,
      daysWithTx: sql<number>`COUNT(DISTINCT ${transactions.dateLocal}) FILTER (WHERE ${transactions.dateLocal} >= ${weekStart})::int`,
      lastIncome: sql<string | null>`MAX(${transactions.dateLocal}) FILTER (WHERE ${transactions.kind} = 'IN')`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))

  const spent7d = await fetchSpent(userId, weekStart, today)

  const [nature] = await db
    .select({
      discretionary: sql<number>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${categories.nature} = 'discretionary'), 0)::bigint`,
      categorized: sql<number>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${categories.nature} IS NOT NULL), 0)::bigint`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, 'OUT'),
        eq(transactions.source, 'manual'),
        gte(transactions.dateLocal, weekStart),
        lte(transactions.dateLocal, today),
      ),
    )

  const categorized = Number(nature?.categorized ?? 0)

  return {
    txCountTotal: counts?.total ?? 0,
    txCountToday: counts?.todayCount ?? 0,
    spent7d,
    daysWithTx7d: counts?.daysWithTx ?? 0,
    // Tanpa transaksi berkategori, porsi keinginan tidak diketahui — bukan nol.
    discretionaryShare7d:
      categorized > 0 ? Number(nature?.discretionary ?? 0) / categorized : null,
    daysSinceIncome: counts?.lastIncome ? daysBetween(counts.lastIncome, today) : null,
    unpaidFixedCostCount: obligations.unpaidCount,
    unpaidFixedCostAmount: obligations.unpaidAmount,
    daysToNextDue: obligations.daysToNextDue,
  }
}

const resolveAnchor = async (
  userId: string,
  today: string,
  funds: Funds,
  config: Settings,
): Promise<AllowanceAnchor> => {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(allowanceAnchors)
    .where(eq(allowanceAnchors.userId, userId))
    .orderBy(desc(allowanceAnchors.anchoredOn))
    .limit(1)

  const current: AllowanceAnchor | null = existing
    ? {
        anchoredOn: existing.anchoredOn,
        baseAllowance: existing.baseAllowance,
        flexibleAtAnchor: existing.flexibleAtAnchor,
      }
    : null

  if (current && !needsReanchor(current, today, funds)) {
    return current
  }

  const fresh = createAnchor(today, funds, config)
  await db
    .insert(allowanceAnchors)
    .values({ userId, ...fresh })
    .onConflictDoUpdate({
      target: [allowanceAnchors.userId, allowanceAnchors.anchoredOn],
      set: {
        baseAllowance: fresh.baseAllowance,
        flexibleAtAnchor: fresh.flexibleAtAnchor,
      },
    })

  return fresh
}

/**
 * Carry diambil dari rekap kemarin yang tersimpan, bukan dihitung ulang.
 * Kalau transaksi lama diedit, jatah kemarin tetap seperti yang pengguna lihat
 * kemarin — riwayat tidak berubah di belakang punggungnya.
 */
const resolveCarry = async (userId: string, today: string): Promise<number> => {
  const [yesterday] = await getDb()
    .select()
    .from(dailyLedger)
    .where(
      and(eq(dailyLedger.userId, userId), eq(dailyLedger.dateLocal, addDays(today, -1))),
    )
    .limit(1)

  if (!yesterday) return 0
  return computeCarry(yesterday.baseAllowance + yesterday.carry, yesterday.spent)
}

const fetchLastMemory = async (userId: string): Promise<MemoryEntry | null> => {
  const [row] = await getDb()
    .select()
    .from(coachingMemory)
    .where(eq(coachingMemory.userId, userId))
    .orderBy(desc(coachingMemory.createdAt))
    .limit(1)

  return row
    ? {
        dateLocal: row.dateLocal,
        mode: row.mode,
        headline: row.headline,
        ruleId: row.ruleId,
      }
    : null
}

/** Seluruh keadaan hari ini dalam satu panggilan. */
export const getDailyState = async (user: CurrentUser): Promise<DailyState> => {
  const config = toSettings(user.settings)
  const today = todayIn(user.timezone)

  const [liquidBalance, obligations] = await Promise.all([
    fetchLiquidBalance(user.id),
    fetchObligations(user.id, today, config.obligationHorizonDays),
  ])

  const funds = computeFunds({
    liquidBalance,
    scheduledObligations: obligations.scheduled,
    settings: config,
  })

  const [anchor, carry, spentToday, stats, lastMemory] = await Promise.all([
    resolveAnchor(user.id, today, funds, config),
    resolveCarry(user.id, today),
    fetchSpent(user.id, today, today),
    fetchStats(user.id, today, obligations),
    fetchLastMemory(user.id),
  ])

  const allowance = computeDailyAllowance(anchor, carry, spentToday)

  await getDb()
    .insert(dailyLedger)
    .values({
      userId: user.id,
      dateLocal: today,
      baseAllowance: anchor.baseAllowance,
      carry,
      spent: spentToday,
    })
    .onConflictDoUpdate({
      target: [dailyLedger.userId, dailyLedger.dateLocal],
      set: { baseAllowance: anchor.baseAllowance, carry, spent: spentToday },
    })

  const insight = computeInsight({
    today,
    timeBucket: timeBucketOf(hourIn(user.timezone)),
    settings: config,
    funds,
    allowance,
    stats,
    lastMemory,
  })

  return { today, funds, allowance, anchor, obligations, stats, insight }
}
