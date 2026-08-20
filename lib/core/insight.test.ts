import { describe, expect, it } from 'vitest'
import { computeInsight, shouldRecordMemory, timeBucketOf } from './insight'
import { computeDailyAllowance, createAnchor } from './allowance'
import { computeFunds } from './funds'
import { analyzeIncome } from './cadence'
import { computePace } from './pace'
import { DEFAULT_SETTINGS, type Settings } from './types'
import type { InsightInput, InsightStats, MemoryEntry } from './insight-types'

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  dailyLivingCost: 100_000,
  bufferDays: 30,
  allowanceHorizonDays: 30,
  allowanceMax: 500_000,
  ...overrides,
})

const stats = (overrides: Partial<InsightStats> = {}): InsightStats => ({
  txCountTotal: 50,
  txCountToday: 2,
  spent7d: 400_000,
  daysWithTx7d: 3,
  discretionaryShare7d: 0.2,
  daysSinceIncome: 3,
  incomeToday: 0,
  unpaidFixedCostCount: 0,
  unpaidFixedCostAmount: 0,
  daysToNextDue: null,
  wishReadyCount: 0,
  wishWaitingCount: 0,
  wishWaitingAmount: 0,
  ...overrides,
})

/** Belum ada riwayat pemasukan, jadi laju dan ritme netral kecuali diminta lain. */
const emptyCadence = analyzeIncome([], '2026-08-20')

const calmPace = (funds: ReturnType<typeof computeFunds>, plannedDaily: number) =>
  computePace({
    daysSinceIncome: null,
    spentSinceIncome: 0,
    plannedDaily,
    available: funds.available,
    cadence: emptyCadence,
  })

const build = (
  liquidBalance: number,
  spentToday: number,
  overrides: Partial<InsightInput> = {},
  config = settings(),
): InsightInput => {
  const funds = computeFunds({
    liquidBalance,
    scheduledObligations: 0,
    settings: config,
  })
  const anchor = createAnchor('2026-08-20', funds, config)
  return {
    today: '2026-08-20',
    timeBucket: 'midday',
    settings: config,
    funds,
    allowance: computeDailyAllowance(anchor, 0, spentToday),
    stats: stats(),
    pace: calmPace(funds, anchor.baseAllowance),
    cadence: emptyCadence,
    lastMemory: null,
    ...overrides,
  }
}

describe('timeBucketOf', () => {
  it('memetakan jam ke potongan hari', () => {
    expect(timeBucketOf(7)).toBe('morning')
    expect(timeBucketOf(12)).toBe('midday')
    expect(timeBucketOf(16)).toBe('afternoon')
    expect(timeBucketOf(20)).toBe('evening')
    expect(timeBucketOf(2)).toBe('night')
  })
})

describe('prioritas aturan', () => {
  it('onboarding menang di atas segalanya saat biaya hidup kosong', () => {
    const input = build(500_000, 999_999, {}, settings({ dailyLivingCost: 0 }))
    expect(computeInsight(input).ruleId).toBe('onboarding_incomplete')
  })

  it('runway genting menang di atas kelebihan belanja', () => {
    // saldo 500rb, biaya hidup 100rb/hari -> runway 5 hari
    const input = build(500_000, 999_999)
    expect(computeInsight(input).ruleId).toBe('runway_critical')
  })

  it('kelebihan belanja menang di atas penyangga tipis', () => {
    const config = settings()
    const funds = computeFunds({
      liquidBalance: 2_000_000,
      scheduledObligations: 0,
      settings: config,
    })
    const anchor = createAnchor('2026-08-20', funds, config)
    const input: InsightInput = {
      ...build(2_000_000, 0, {}, config),
      // penyangga tipis, tapi ada jatah dari carry dan sudah dilewati
      allowance: computeDailyAllowance(anchor, 100_000, 150_000),
    }
    expect(computeInsight(input).ruleId).toBe('overspent_today')
  })

  it('jatuh tempo dekat muncul sebelum catatan harian', () => {
    const input = build(10_000_000, 0, {
      stats: stats({
        txCountToday: 0,
        unpaidFixedCostCount: 2,
        unpaidFixedCostAmount: 2_500_000,
        daysToNextDue: 3,
      }),
    })
    expect(computeInsight(input).ruleId).toBe('fixed_cost_due_soon')
  })

  it('jatuh tempo jauh tidak memicu aturan itu', () => {
    const input = build(10_000_000, 0, {
      stats: stats({
        unpaidFixedCostCount: 1,
        unpaidFixedCostAmount: 500_000,
        daysToNextDue: 20,
      }),
    })
    expect(computeInsight(input).ruleId).not.toBe('fixed_cost_due_soon')
  })

  it('mendeteksi hampir menyentuh batas', () => {
    // fleksibel 7jt / 30 = 233rb -> jatah 233rb; 200rb = 86%
    const input = build(10_000_000, 200_000)
    expect(computeInsight(input).ruleId).toBe('near_limit')
  })

  it('mendeteksi pemasukan sepi', () => {
    const input = build(10_000_000, 0, {
      stats: stats({ daysSinceIncome: 30 }),
    })
    expect(computeInsight(input).ruleId).toBe('income_drought')
  })

  it('mendeteksi dominasi keinginan', () => {
    const input = build(10_000_000, 0, {
      stats: stats({ discretionaryShare7d: 0.75 }),
    })
    expect(computeInsight(input).ruleId).toBe('discretionary_heavy')
  })

  it('memuji konsistensi', () => {
    const input = build(10_000_000, 0, {
      stats: stats({ daysWithTx7d: 7 }),
    })
    expect(computeInsight(input).ruleId).toBe('consistency_praise')
  })

  it('jatuh ke steady ketika semua tenang', () => {
    const input = build(10_000_000, 0, { stats: stats({ txCountToday: 1 }) })
    expect(computeInsight(input).ruleId).toBe('steady')
  })

  it('hari pemasukan menang di atas hampir semua hal', () => {
    const input = build(10_000_000, 200_000, {
      stats: stats({ incomeToday: 5_000_000, daysSinceIncome: 0 }),
    })
    expect(computeInsight(input).ruleId).toBe('fresh_income')
  })

  it('laju terlalu cepat muncul sebelum kelebihan belanja hari ini', () => {
    const config = settings()
    const funds = computeFunds({
      liquidBalance: 10_000_000,
      scheduledObligations: 0,
      settings: config,
    })
    const anchor = createAnchor('2026-08-20', funds, config)
    const input: InsightInput = {
      ...build(10_000_000, 999_999, {}, config),
      pace: computePace({
        daysSinceIncome: 6,
        spentSinceIncome: 3_000_000,
        plannedDaily: anchor.baseAllowance,
        available: funds.available,
        cadence: emptyCadence,
      }),
    }
    expect(computeInsight(input).ruleId).toBe('burning_too_fast')
  })

  it('keinginan yang lewat masa tunggu diangkat sebelum tagihan', () => {
    const input = build(10_000_000, 0, {
      stats: stats({
        wishReadyCount: 1,
        wishWaitingCount: 2,
        wishWaitingAmount: 800_000,
        unpaidFixedCostCount: 1,
        unpaidFixedCostAmount: 500_000,
        daysToNextDue: 2,
      }),
    })
    expect(computeInsight(input).ruleId).toBe('wish_ready')
  })

  it('selalu menghasilkan langkah berikutnya yang terisi', () => {
    const insight = computeInsight(build(10_000_000, 0))
    expect(insight.nextStep.length).toBeGreaterThan(0)
    expect(insight.bullets.length).toBeGreaterThan(0)
  })
})

describe('continuity', () => {
  const memory = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
    dateLocal: '2026-08-19',
    mode: 'tight',
    headline: 'Penyangga baru terisi 40%.',
    ruleId: 'buffer_low',
    ...overrides,
  })

  it('mengakui pemulihan setelah hari yang ketat', () => {
    const input = build(10_000_000, 0, {
      stats: stats({ txCountToday: 1 }),
      lastMemory: memory(),
    })
    expect(computeInsight(input).continuityLine).toContain('mulai lagi pelan-pelan')
  })

  it('menyapa pengguna yang belum punya riwayat', () => {
    expect(computeInsight(build(10_000_000, 0)).continuityLine).not.toBeNull()
  })

  it('diam ketika catatan terakhir sudah dari hari ini', () => {
    const input = build(10_000_000, 0, {
      stats: stats({ txCountToday: 1 }),
      lastMemory: memory({ dateLocal: '2026-08-20', mode: 'calm' }),
    })
    expect(computeInsight(input).continuityLine).toBeNull()
  })
})

describe('shouldRecordMemory', () => {
  const insight = computeInsight(build(10_000_000, 0, { stats: stats({ txCountToday: 1 }) }))

  it('mencatat saat belum ada riwayat', () => {
    expect(shouldRecordMemory(insight, null, '2026-08-20')).toBe(true)
  })

  it('mencatat di hari baru', () => {
    const last: MemoryEntry = {
      dateLocal: '2026-08-19',
      mode: 'calm',
      headline: 'x',
      ruleId: 'steady',
    }
    expect(shouldRecordMemory(insight, last, '2026-08-20')).toBe(true)
  })

  it('tidak mencatat ulang rule yang sama di hari yang sama', () => {
    const last: MemoryEntry = {
      dateLocal: '2026-08-20',
      mode: 'calm',
      headline: 'x',
      ruleId: 'steady',
    }
    expect(shouldRecordMemory(insight, last, '2026-08-20')).toBe(false)
  })

  it('mencatat saat rule berubah di hari yang sama', () => {
    const last: MemoryEntry = {
      dateLocal: '2026-08-20',
      mode: 'calm',
      headline: 'x',
      ruleId: 'near_limit',
    }
    expect(shouldRecordMemory(insight, last, '2026-08-20')).toBe(true)
  })
})
