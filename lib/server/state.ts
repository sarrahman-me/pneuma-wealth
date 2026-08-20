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
  wishItems,
} from '../db/schema'
import {
  computeBaseAllowance,
  resolveHorizonDays,
  computeCarry,
  computeDailyAllowance,
  createAnchor,
  needsReanchor,
} from '../core/allowance'
import { planIncome, type IncomePlan } from '../core/income'
import { computeFunds } from '../core/funds'
import { analyzeIncome, type IncomeCadence } from '../core/cadence'
import { computePace, type Pace } from '../core/pace'
import { computeInsight, timeBucketOf } from '../core/insight'
import { addDays, daysBetween } from '../core/money'
import { occurrencesWithin, periodKeyFor } from '../core/due'
import { hourIn, todayIn } from '../core/timezone'
import type { AllowanceAnchor, DailyAllowance, Funds, Settings } from '../core/types'
import type { CoachingInsight, InsightStats, MemoryEntry } from '../core/insight-types'
import type { CurrentUser } from './user'

export type Obligations = {
  /** Total kewajiban yang jatuh tempo dalam horizon — inilah yang dipotong di depan. */
  scheduled: number
  /**
   * Berapa *tagihan* yang punya kejadian belum lunas dalam horizon — dihitung
   * per tagihan, bukan per kejadian. Satu biaya harian akan menghasilkan tiga
   * puluh kejadian, dan "30 tagihan belum lunas" bukan kalimat yang benar.
   */
  unpaidCount: number
  /**
   * Nilai seluruh kejadian yang belum lunas dalam horizon. Sengaja dibatasi
   * horizon: dengan siklus harian, "belum lunas selamanya" adalah angka tak
   * hingga dan tidak berarti apa-apa.
   */
  unpaidAmount: number
  daysToNextDue: number | null
}

/** Satu hari di grafik ritme: yang dipakai versus yang dijatah. */
export type DayPoint = {
  dateLocal: string
  spent: number
  allowed: number
}

/** Satu titik di kurva pembakaran sejak pemasukan terakhir. */
export type BurnPoint = {
  dateLocal: string
  dayIndex: number
  cumulative: number
  planned: number
}

export type DailyState = {
  today: string
  funds: Funds
  allowance: DailyAllowance
  anchor: AllowanceAnchor
  obligations: Obligations
  /** Horizon jatah yang benar-benar dipakai, dan dari mana asalnya. */
  horizon: { days: number; fromCadence: boolean }
  stats: InsightStats
  insight: CoachingInsight
  cadence: IncomeCadence
  pace: Pace
  /** 14 hari terakhir, untuk grafik ritme harian. */
  recentDays: DayPoint[]
  /** Kurva kumulatif sejak pemasukan terakhir. Kosong bila belum ada pemasukan. */
  burn: BurnPoint[]
  /** Pemecahan pemasukan yang masuk hari ini. Null bila hari ini tidak ada. */
  incomePlan: IncomePlan | null
}

const toSettings = (row: CurrentUser['settings']): Settings => ({
  dailyLivingCost: row.dailyLivingCost,
  bufferDays: row.bufferDays,
  bufferFillPercent: row.bufferFillPercent,
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

  // Siklus pendek jatuh tempo berkali-kali dalam satu horizon. Menyisihkan
  // hanya kejadian terdekat akan membuat jatah harian tampak lebih longgar
  // daripada uang yang sebenarnya sudah punya nama.
  for (const cost of active) {
    let hasUnpaid = false

    for (const due of occurrencesWithin(today, cost, horizonDays)) {
      if (paidKeys.has(`${cost.id}:${periodKeyFor(cost.recurrence, due)}`)) continue

      const days = daysBetween(today, due)
      hasUnpaid = true
      unpaidAmount += cost.amount
      scheduled += cost.amount
      if (daysToNextDue === null || days < daysToNextDue) {
        daysToNextDue = days
      }
    }

    if (hasUnpaid) unpaidCount += 1
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
  wish: WishSummary,
): Promise<InsightStats> => {
  const db = getDb()
  const weekStart = addDays(today, -6)

  const [counts] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      todayCount: sql<number>`COUNT(*) FILTER (WHERE ${transactions.dateLocal} = ${today})::int`,
      daysWithTx: sql<number>`COUNT(DISTINCT ${transactions.dateLocal}) FILTER (WHERE ${transactions.dateLocal} >= ${weekStart})::int`,
      lastIncome: sql<string | null>`MAX(${transactions.dateLocal}) FILTER (WHERE ${transactions.kind} = 'IN')`,
      incomeToday: sql<number>`COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.kind} = 'IN' AND ${transactions.dateLocal} = ${today}), 0)::bigint`,
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
    incomeToday: Number(counts?.incomeToday ?? 0),
    unpaidFixedCostCount: obligations.unpaidCount,
    unpaidFixedCostAmount: obligations.unpaidAmount,
    daysToNextDue: obligations.daysToNextDue,
    wishReadyCount: wish.readyCount,
    wishWaitingCount: wish.waitingCount,
    wishWaitingAmount: wish.waitingAmount,
  }
}


export type WishSummary = {
  readyCount: number
  waitingCount: number
  waitingAmount: number
}

const fetchWishSummary = async (
  userId: string,
  today: string,
): Promise<WishSummary> => {
  const [row] = await getDb()
    .select({
      waitingCount: sql<number>`COUNT(*)::int`,
      readyCount: sql<number>`COUNT(*) FILTER (WHERE ${wishItems.readyOn} <= ${today})::int`,
      waitingAmount: sql<number>`COALESCE(SUM(${wishItems.amount}), 0)::bigint`,
    })
    .from(wishItems)
    .where(and(eq(wishItems.userId, userId), eq(wishItems.status, 'waiting')))

  return {
    readyCount: row?.readyCount ?? 0,
    waitingCount: row?.waitingCount ?? 0,
    waitingAmount: Number(row?.waitingAmount ?? 0),
  }
}

/** Setahun ke belakang sudah cukup untuk membaca ritme tanpa memuat semuanya. */
const CADENCE_LOOKBACK_DAYS = 365

const fetchIncomeEvents = async (userId: string, today: string) => {
  const rows = await getDb()
    .select({
      dateLocal: transactions.dateLocal,
      amount: sql<number>`SUM(${transactions.amount})::bigint`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, 'IN'),
        gte(transactions.dateLocal, addDays(today, -CADENCE_LOOKBACK_DAYS)),
      ),
    )
    .groupBy(transactions.dateLocal)
    .orderBy(transactions.dateLocal)

  return rows.map((row) => ({ dateLocal: row.dateLocal, amount: Number(row.amount) }))
}

/** Pengeluaran manual per hari dalam rentang, hanya hari yang ada catatannya. */
const fetchDailySpend = async (userId: string, from: string, to: string) => {
  const rows = await getDb()
    .select({
      dateLocal: transactions.dateLocal,
      total: sql<number>`SUM(${transactions.amount})::bigint`,
    })
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
    .groupBy(transactions.dateLocal)

  return new Map(rows.map((row) => [row.dateLocal, Number(row.total)]))
}

/** Jatah yang berlaku di tiap hari, diambil dari rekap yang sudah tersimpan. */
const fetchLedgerAllowances = async (userId: string, from: string, to: string) => {
  const rows = await getDb()
    .select()
    .from(dailyLedger)
    .where(
      and(
        eq(dailyLedger.userId, userId),
        gte(dailyLedger.dateLocal, from),
        lte(dailyLedger.dateLocal, to),
      ),
    )

  return new Map(
    rows.map((row) => [row.dateLocal, Math.max(0, row.baseAllowance + row.carry)]),
  )
}

export const RECENT_DAYS = 14

/**
 * Deret harian untuk grafik. Hari tanpa rekap memakai jatah yang berlaku
 * sekarang sebagai perkiraan — lebih berguna daripada lubang di grafik.
 */
const buildRecentDays = (
  today: string,
  spendByDate: Map<string, number>,
  allowedByDate: Map<string, number>,
  fallbackAllowed: number,
): DayPoint[] =>
  Array.from({ length: RECENT_DAYS }, (_, offset) => {
    const dateLocal = addDays(today, -(RECENT_DAYS - 1 - offset))
    return {
      dateLocal,
      spent: spendByDate.get(dateLocal) ?? 0,
      allowed: allowedByDate.get(dateLocal) ?? fallbackAllowed,
    }
  })

/**
 * Kurva pembakaran sejak pemasukan terakhir: kumulatif nyata versus garis
 * rencana. Inilah bentuk visual dari "habis di minggu pertama".
 */
const buildBurn = (
  today: string,
  lastIncomeDate: string | null,
  spendByDate: Map<string, number>,
  plannedDaily: number,
): BurnPoint[] => {
  if (!lastIncomeDate) return []

  const span = Math.min(daysBetween(lastIncomeDate, today), 90)
  if (span < 0) return []

  let cumulative = 0
  return Array.from({ length: span + 1 }, (_, dayIndex) => {
    const dateLocal = addDays(lastIncomeDate, dayIndex)
    cumulative += spendByDate.get(dateLocal) ?? 0
    return {
      dateLocal,
      dayIndex,
      cumulative,
      planned: plannedDaily * (dayIndex + 1),
    }
  })
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

  const [liquidBalance, obligations, wish, incomeEvents] = await Promise.all([
    fetchLiquidBalance(user.id),
    fetchObligations(user.id, today, config.obligationHorizonDays),
    fetchWishSummary(user.id, today),
    fetchIncomeEvents(user.id, today),
  ])

  const funds = computeFunds({
    liquidBalance,
    scheduledObligations: obligations.scheduled,
    settings: config,
  })

  const cadence = analyzeIncome(incomeEvents, today)

  // Jatah dibagi sepanjang jeda pemasukan yang benar-benar terjadi, bukan
  // sepanjang angka bulat yang kebetulan jadi default.
  const horizon = resolveHorizonDays(config, cadence)
  const planning: Settings = { ...config, allowanceHorizonDays: horizon.days }

  const [anchor, carry, stats, lastMemory] = await Promise.all([
    resolveAnchor(user.id, today, funds, planning),
    resolveCarry(user.id, today),
    fetchStats(user.id, today, obligations, wish),
    fetchLastMemory(user.id),
  ])

  // Rentang harian menutupi grafik 14 hari sekaligus siklus sejak pemasukan
  // terakhir, jadi cukup satu query untuk keduanya.
  const seriesStart = [
    addDays(today, -(RECENT_DAYS - 1)),
    cadence.lastDate ?? today,
  ].sort()[0]

  const [spendByDate, allowedByDate] = await Promise.all([
    fetchDailySpend(user.id, seriesStart, today),
    fetchLedgerAllowances(user.id, addDays(today, -(RECENT_DAYS - 1)), today),
  ])

  const spentToday = spendByDate.get(today) ?? 0
  const allowance = computeDailyAllowance(anchor, carry, spentToday)

  const spentSinceIncome = cadence.lastDate
    ? sumRange(spendByDate, cadence.lastDate, today)
    : 0

  const pace = computePace({
    daysSinceIncome: cadence.daysSinceLast,
    spentSinceIncome,
    plannedDaily: anchor.baseAllowance,
    available: funds.available,
    cadence,
  })

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

  // Dihitung dari keadaan sebelum pemasukan hari ini, supaya pengguna melihat
  // uang yang baru masuk langsung terpecah jadi bagian-bagian yang punya nama.
  const incomePlan =
    stats.incomeToday > 0
      ? planIncome(
          stats.incomeToday,
          computeFunds({
            liquidBalance: liquidBalance - stats.incomeToday,
            scheduledObligations: obligations.scheduled,
            settings: config,
          }),
          planning,
          computeBaseAllowance,
        )
      : null

  const insight = computeInsight({
    today,
    timeBucket: timeBucketOf(hourIn(user.timezone)),
    settings: config,
    funds,
    allowance,
    stats,
    pace,
    cadence,
    lastMemory,
  })

  return {
    today,
    funds,
    allowance,
    anchor,
    obligations,
    horizon,
    stats,
    insight,
    cadence,
    pace,
    recentDays: buildRecentDays(today, spendByDate, allowedByDate, allowance.allowed),
    burn: buildBurn(today, cadence.lastDate, spendByDate, anchor.baseAllowance),
    incomePlan,
  }
}

/** Total nilai peta harian dalam rentang tanggal, inklusif di kedua ujung. */
const sumRange = (
  byDate: Map<string, number>,
  from: string,
  to: string,
): number => {
  let total = 0
  for (const [dateLocal, amount] of byDate) {
    if (dateLocal >= from && dateLocal <= to) total += amount
  }
  return total
}
